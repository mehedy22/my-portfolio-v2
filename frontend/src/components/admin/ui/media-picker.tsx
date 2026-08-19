"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useRef, useState } from "react";
import { api, apiBaseUrl, getAccessToken, mediaUrl } from "@/lib/admin/api";
import { Button } from "@/components/admin/ui/primitives";

/**
 * Picks a media item for a content field — choose one already uploaded, or upload a new one
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
  const client = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [browsing, setBrowsing] = useState(false);
  const [altText, setAltText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const library = useQuery({
    queryKey: ["media-picker"],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/media", {
        params: { query: { page: 0, size: 100 } },
      });
      if (!response.ok) throw new Error("Could not load the media library.");
      return (data?.data?.content ?? []) as MediaItem[];
    },
  });

  const selected = library.data?.find((item) => item.id === value);

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
    if (uploaded?.id) onChange(uploaded.id);
  }

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
          if (file) void upload(file);
        }}
      />

      {error ? (
        <p role="alert" className="mt-2 text-xs text-warning">
          {error}
        </p>
      ) : null}

      {browsing ? (
        <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-border p-2">
          {library.isLoading ? (
            <p className="p-2 text-xs text-muted">Loading…</p>
          ) : (library.data ?? []).length === 0 ? (
            <p className="p-2 text-xs text-muted">Nothing uploaded yet.</p>
          ) : (
            <ul className="grid grid-cols-4 gap-2">
              {(library.data ?? []).map((item) => {
                const url = mediaUrl(item.url);
                const isSelected = item.id === value;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      title={item.originalFileName}
                      onClick={() => {
                        onChange(item.id ?? null);
                        setBrowsing(false);
                      }}
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
          )}
        </div>
      ) : null}
    </div>
  );
}
