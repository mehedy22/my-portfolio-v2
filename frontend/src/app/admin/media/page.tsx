"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useRef, useState } from "react";
import { api, apiBaseUrl, getAccessToken, mediaUrl } from "@/lib/admin/api";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  Toast,
} from "@/components/admin/ui/primitives";
import { useToast } from "@/lib/admin/use-toast";
import type { components } from "@/generated/api/schema";

type Media = components["schemas"]["MediaResponse"];

export default function MediaPage() {
  const client = useQueryClient();
  const { message, show } = useToast();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [altText, setAltText] = useState("");
  // Alt text is required for images and meaningless for documents, so the form asks for it only
  // when it applies — and refuses to submit an image without it, matching the API rule.
  const [pendingIsImage, setPendingIsImage] = useState(false);

  const list = useQuery({
    queryKey: ["media"],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/media", {
        params: { query: { page: 0, size: 100 } },
      });
      if (!response.ok) throw new Error("Could not load the media library.");
      return data?.data?.content ?? [];
    },
  });

  /**
   * Uploads go through plain fetch rather than the generated client: this is multipart, and the
   * generated client is built around JSON bodies. The bearer token is attached by hand for the
   * same reason.
   */
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      if (altText.trim()) body.append("altText", altText.trim());

      const response = await fetch(`${apiBaseUrl}/api/v1/admin/media`, {
        method: "POST",
        body,
        credentials: "include",
        headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : undefined,
      });
      if (!response.ok) {
        const envelope = await response.json().catch(() => null);
        // The backend's message already explains *why* (wrong type, too big) — show that, not a
        // generic failure.
        throw new Error(envelope?.message ?? "Upload failed.");
      }
      return (await response.json())?.data as Media;
    },
    onSuccess: () => {
      setUploadError(null);
      setAltText("");
      if (fileInput.current) fileInput.current.value = "";
      client.invalidateQueries({ queryKey: ["media"] });
      show("File uploaded");
    },
    onError: (error: Error) => setUploadError(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { response } = await api.DELETE("/api/v1/admin/media/{id}", {
        params: { path: { id } },
      });
      if (!response.ok) throw new Error("Could not delete this file.");
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["media"] });
      show("File deleted");
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Media library" />

      <Card className="mb-8">
        <h2 className="font-display text-base font-semibold">Upload</h2>
        <p className="mt-1 text-sm text-muted">
          JPEG, PNG, GIF or WebP images up to 5 MB, or a PDF up to 10 MB. Images need alt text.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            className="text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setPendingIsImage(Boolean(file?.type.startsWith("image/")));
              setUploadError(null);
              if (!file) return;
              if (file.type.startsWith("image/") && !altText.trim()) {
                setUploadError("Describe the image first — alt text is required for images.");
                return;
              }
              upload.mutate(file);
            }}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted">
              Alt text{pendingIsImage ? " (required for images)" : " (images only)"}
            </span>
            <input
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              placeholder="Describe the image"
              aria-required={pendingIsImage}
              className="rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
          </label>
          {pendingIsImage && !altText.trim() ? (
            <Button
              variant="ghost"
              onClick={() => {
                const file = fileInput.current?.files?.[0];
                if (file && altText.trim()) upload.mutate(file);
              }}
              disabled
            >
              Add alt text to upload
            </Button>
          ) : null}
        </div>
        {upload.isPending ? <p className="mt-3 text-sm text-muted">Uploading…</p> : null}
        {uploadError ? (
          <p role="alert" className="mt-3 text-sm text-warning">
            {uploadError}
          </p>
        ) : null}
      </Card>

      {list.isLoading ? (
        <ListSkeleton rows={3} />
      ) : list.error ? (
        <ErrorState message="Could not load the media library." onRetry={() => list.refetch()} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState message="No files yet — upload your first one above." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(list.data ?? []).map((item) => {
            const url = mediaUrl(item.url);
            const isImage = item.mimeType?.startsWith("image/");
            return (
              <li key={item.id}>
                <Card>
                  {isImage && url ? (
                    <Image
                      src={url}
                      alt={item.altText || item.originalFileName || ""}
                      width={320}
                      height={180}
                      unoptimized
                      className="mb-3 h-32 w-full rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="mb-3 grid h-32 place-items-center rounded-lg border border-border text-sm text-muted">
                      {item.mimeType}
                    </div>
                  )}
                  <p className="truncate text-sm font-medium">{item.originalFileName}</p>
                  <p className="text-xs text-muted">
                    {item.width && item.height ? `${item.width}×${item.height} · ` : ""}
                    {Math.round((item.sizeBytes ?? 0) / 1024)} KB
                  </p>
                  <p className="mt-1 truncate text-xs text-muted">id {item.id}</p>
                  <div className="mt-3 flex gap-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-border px-3 py-1.5 text-xs transition hover:border-accent hover:text-accent"
                    >
                      Open
                    </a>
                    <Button
                      variant="danger"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => item.id && remove.mutate(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Toast message={message} />
    </div>
  );
}
