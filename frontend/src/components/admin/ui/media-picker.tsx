"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { api, apiBaseUrl, getAccessToken, mediaUrl } from "@/lib/admin/api";
import { Button } from "@/components/admin/ui/primitives";

/**
 * Picks media for a content field — choose something already uploaded, or upload a new file
 * without leaving the form.
 *
 * <p>Replaces typing a numeric id into a box. The id was never the point; it was the only thing
 * the form could ask for before this existed, and it meant opening the Media library in another
 * tab, finding the file, and copying a number back.
 */
type MediaItem = {
  id?: number;
  url?: string;
  originalFileName?: string;
  altText?: string;
  mimeType?: string;
};

/** One library read shared by every picker on the form — the cache key is deliberately common. */
function useMediaLibrary() {
  return useQuery({
    queryKey: ["media-picker"],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/media", {
        params: { query: { page: 0, size: 100 } },
      });
      if (!response.ok) throw new Error("Could not load the media library.");
      return (data?.data?.content ?? []) as MediaItem[];
    },
  });
}

/**
 * The upload half, shared by the single and multi pickers.
 *
 * <p>It posts with `fetch` rather than the generated client because this is `multipart/form-data`:
 * the openapi-fetch client serialises JSON, and handing it a FormData body would send the wrong
 * content type.
 */
function useMediaUpload(onUploaded: (id: number) => void) {
  const client = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [altText, setAltText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setError(null);
    // The API requires alt text for images; asking here beats a round-trip that fails.
    if (file.type.startsWith("image/") && !altText.trim()) {
      setError("Describe the image first — alt text is required for images.");
      return;
    }
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    if (altText.trim()) body.append("altText", altText.trim());

    const response = await fetch(`${apiBaseUrl}/api/v1/admin/media`, {
      method: "POST",
      body,
      credentials: "include",
      headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : undefined,
    });
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";

    if (!response.ok) {
      const envelope = await response.json().catch(() => null);
      // The API's message explains why (wrong type, too big); show that, not a generic failure.
      setError(envelope?.message ?? "Upload failed.");
      return;
    }
    const uploaded = (await response.json())?.data as MediaItem;
    setAltText("");
    await client.invalidateQueries({ queryKey: ["media-picker"] });
    await client.invalidateQueries({ queryKey: ["media"] });
    if (uploaded?.id) onUploaded(uploaded.id);
  }

  return { upload, uploading, error, setError, altText, setAltText, fileInput };
}

/** The alt-text box plus the hidden file input, identical in both pickers. */
function UploadControls({
  altText,
  setAltText,
  fileInput,
  accept,
  onFile,
  error,
}: {
  altText: string;
  setAltText: (value: string) => void;
  fileInput: React.RefObject<HTMLInputElement | null>;
  accept: string;
  onFile: (file: File) => void;
  error: string | null;
}) {
  return (
    <>
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs text-muted">Alt text (required to upload an image)</span>
        <input
          value={altText}
          onChange={(event) => setAltText(event.target.value)}
          placeholder="e.g. University of Dhaka logo"
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <input
        ref={fileInput}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
      />

      {error ? (
        <p role="alert" className="mt-2 text-xs text-warning">
          {error}
        </p>
      ) : null}
    </>
  );
}

/** The library grid, shown while browsing. `selected` marks what is already chosen. */
function LibraryGrid({
  items,
  loading,
  selected,
  onPick,
}: {
  items: MediaItem[];
  loading: boolean;
  selected: number[];
  onPick: (id: number) => void;
}) {
  if (loading) return <p className="p-2 text-xs text-muted">Loading…</p>;
  if (items.length === 0) return <p className="p-2 text-xs text-muted">Nothing uploaded yet.</p>;

  return (
    <ul className="grid grid-cols-4 gap-2">
      {items.map((item) => {
        const url = mediaUrl(item.url);
        const isSelected = item.id != null && selected.includes(item.id);
        return (
          <li key={item.id}>
            <button
              type="button"
              title={item.originalFileName}
              onClick={() => item.id != null && onPick(item.id)}
              className={`relative block h-16 w-full overflow-hidden rounded-lg border transition ${
                isSelected ? "border-accent ring-2 ring-accent" : "border-border hover:border-accent"
              }`}
            >
              {url && item.mimeType?.startsWith("image/") ? (
                <Image
                  src={url}
                  alt={item.altText || ""}
                  fill
                  unoptimized
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <span className="grid h-full w-full place-items-center text-[10px] text-muted">
                  {item.mimeType?.split("/")[1] ?? "file"}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function MediaPicker({
  value,
  onChange,
  accept = "image/*",
  label = "image",
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  accept?: string;
  label?: string;
}) {
  const library = useMediaLibrary();
  const [browsing, setBrowsing] = useState(false);
  const { upload, uploading, error, altText, setAltText, fileInput } = useMediaUpload((id) =>
    onChange(id),
  );

  const selected = library.data?.find((item) => item.id === value);
  const preview = mediaUrl(selected?.url);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-accent-soft">
          {preview && selected?.mimeType?.startsWith("image/") ? (
            <Image
              src={preview}
              alt={selected?.altText || ""}
              fill
              unoptimized
              sizes="56px"
              className="object-contain"
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-[10px] text-muted">
              {value ? "file" : "none"}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            {selected?.originalFileName ?? (value ? `Media #${value}` : `No ${label} selected`)}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              className="px-2.5 py-1 text-xs"
              onClick={() => setBrowsing((open) => !open)}
            >
              {browsing ? "Close" : "Choose existing"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="px-2.5 py-1 text-xs"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload new"}
            </Button>
            {value ? (
              <Button
                type="button"
                variant="danger"
                className="px-2.5 py-1 text-xs"
                onClick={() => onChange(null)}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <UploadControls
        altText={altText}
        setAltText={setAltText}
        fileInput={fileInput}
        accept={accept}
        onFile={(file) => void upload(file)}
        error={error}
      />

      {browsing ? (
        <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-border p-2">
          <LibraryGrid
            items={library.data ?? []}
            loading={library.isLoading}
            selected={value != null ? [value] : []}
            onPick={(id) => {
              onChange(id);
              setBrowsing(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The same thing for a set of media rather than one — a project's gallery.
 *
 * <p>Order is part of the value, because the API stores the gallery in the order it is given, so
 * the chosen files are shown as a strip that can be reordered and not as an unordered pile.
 * Picking an item already in the set removes it, which is what clicking a selected thumbnail
 * plainly means.
 */
export function MediaGalleryPicker({
  value,
  onChange,
  accept = "image/*",
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  accept?: string;
}) {
  const library = useMediaLibrary();
  const [browsing, setBrowsing] = useState(false);

  /*
   * Every edit is computed from this ref rather than from the `value` prop, and the ref is moved
   * forward at the moment of the click. Two clicks inside one React tick both see the same prop —
   * the parent has not re-rendered yet — so the second would overwrite the first and one of the
   * two chosen images would silently not be selected.
   */
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const update = (next: number[]) => {
    latest.current = next;
    onChange(next);
  };

  const { upload, uploading, error, altText, setAltText, fileInput } = useMediaUpload((id) => {
    if (!latest.current.includes(id)) update([...latest.current, id]);
  });

  const byId = new Map((library.data ?? []).map((item) => [item.id, item] as const));

  const move = (index: number, delta: number) => {
    const current = latest.current;
    const target = index + delta;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };

  return (
    <div className="rounded-lg border border-border p-3">
      {value.length === 0 ? (
        <p className="text-sm text-muted">No images in the gallery yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {value.map((id, index) => {
            const item = byId.get(id);
            const url = mediaUrl(item?.url);
            return (
              <li key={`${id}-${index}`} className="w-24">
                <div className="relative h-16 w-24 overflow-hidden rounded-lg border border-border bg-accent-soft">
                  {url && item?.mimeType?.startsWith("image/") ? (
                    <Image
                      src={url}
                      alt={item?.altText || ""}
                      fill
                      unoptimized
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-[10px] text-muted">
                      #{id}
                    </span>
                  )}
                  {/* The position, because the number is the whole reason order is editable. */}
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    {index + 1}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    aria-label="Move earlier"
                    title="Move earlier"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded px-1 text-xs text-muted transition hover:text-accent disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label="Remove from gallery"
                    title="Remove from gallery"
                    onClick={() =>
                      update(latest.current.filter((_, position) => position !== index))
                    }
                    className="rounded px-1 text-xs text-muted transition hover:text-warning"
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    aria-label="Move later"
                    title="Move later"
                    disabled={index === value.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded px-1 text-xs text-muted transition hover:text-accent disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          className="px-2.5 py-1 text-xs"
          onClick={() => setBrowsing((open) => !open)}
        >
          {browsing ? "Close" : "Choose existing"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="px-2.5 py-1 text-xs"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "Upload new"}
        </Button>
      </div>

      <UploadControls
        altText={altText}
        setAltText={setAltText}
        fileInput={fileInput}
        accept={accept}
        onFile={(file) => void upload(file)}
        error={error}
      />

      {browsing ? (
        <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-border p-2">
          <LibraryGrid
            items={library.data ?? []}
            loading={library.isLoading}
            selected={value}
            onPick={(id) =>
              update(
                latest.current.includes(id)
                  ? latest.current.filter((item) => item !== id)
                  : [...latest.current, id],
              )
            }
          />
        </div>
      ) : null}
    </div>
  );
}
