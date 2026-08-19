"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiError, mediaUrl } from "@/lib/admin/api";
import { Button, Card, ErrorState, ListSkeleton, PageHeader, Toast } from "@/components/admin/ui/primitives";
import { useToast } from "@/lib/admin/use-toast";

/**
 * Profile photo and resume (D-015). Both reference media uploaded in the Media library; clearing
 * a field only drops the reference, it never deletes the file.
 */
export default function ProfileSettingsPage() {
  const client = useQueryClient();
  const { message: toast, show } = useToast();
  const [photoId, setPhotoId] = useState<string>("");
  const [resumeId, setResumeId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["site-profile"],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/admin/settings/profile", {});
      if (!response.ok) throw new Error("Could not load the profile.");
      return data?.data ?? {};
    },
  });

  useEffect(() => {
    if (!query.data) return;
    setPhotoId(query.data.profileImage?.id ? String(query.data.profileImage.id) : "");
    setResumeId(query.data.resume?.id ? String(query.data.resume.id) : "");
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const result = await api.PUT("/api/v1/admin/settings/profile", {
        // Omitting a field is how a reference is cleared: an absent JSON key binds to null on
        // the record, which is exactly what "no photo" means. The generated types model the
        // field as optional rather than nullable, so this is also the only shape that type-checks.
        body: {
          profileImageMediaId: photoId ? Number(photoId) : undefined,
          resumeMediaId: resumeId ? Number(resumeId) : undefined,
        },
      });
      if (!result.response.ok) throw new Error(apiError(result.error, "Could not save."));
    },
    onSuccess: () => {
      setError(null);
      client.invalidateQueries({ queryKey: ["site-profile"] });
      show("Profile saved");
    },
    onError: (failure: Error) => setError(failure.message),
  });

  if (query.isLoading) return <ListSkeleton rows={3} />;
  if (query.error)
    return <ErrorState message="Could not load the profile." onRetry={() => query.refetch()} />;

  const photoUrl = mediaUrl(query.data?.profileImage?.url);
  const resumeUrl = mediaUrl(query.data?.resume?.url);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile & resume" />
      <Card>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex items-center gap-4">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={query.data?.profileImage?.altText || "Profile photo"}
                width={72}
                height={72}
                unoptimized
                className="h-18 w-18 rounded-xl border border-border object-cover"
              />
            ) : null}
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-sm font-medium">Profile photo media id</span>
              <input
                type="number"
                value={photoId}
                onChange={(event) => setPhotoId(event.target.value)}
                placeholder="Leave empty to clear"
                className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <span className="text-xs text-muted">Upload it in the Media library first.</span>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Resume media id</span>
            <input
              type="number"
              value={resumeId}
              onChange={(event) => setResumeId(event.target.value)}
              placeholder="Leave empty to clear"
              className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {resumeUrl ? (
              <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                Open current resume
              </a>
            ) : null}
          </label>

          {error ? (
            <p role="alert" className="text-sm text-warning">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={save.isPending} className="self-start">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </Card>
      <Toast message={toast} />
    </div>
  );
}
