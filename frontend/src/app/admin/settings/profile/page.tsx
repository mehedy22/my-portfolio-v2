"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiError, mediaUrl } from "@/lib/admin/api";
import { Button, Card, ErrorState, Field, ListSkeleton, PageHeader, Toast } from "@/components/admin/ui/primitives";
import { MediaPicker } from "@/components/admin/ui/media-picker";
import { useToast } from "@/lib/admin/use-toast";

/**
 * Profile photo and resume (D-015). Both are chosen — or uploaded — right here; clearing a field
 * only drops the reference, it never deletes the file.
 */
export default function ProfileSettingsPage() {
  const client = useQueryClient();
  const { message: toast, show } = useToast();
  const [photoId, setPhotoId] = useState<number | null>(null);
  const [resumeId, setResumeId] = useState<number | null>(null);
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
    setPhotoId(query.data.profileImage?.id ?? null);
    setResumeId(query.data.resume?.id ?? null);
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const result = await api.PUT("/api/v1/admin/settings/profile", {
        // Omitting a field is how a reference is cleared: an absent JSON key binds to null on
        // the record, which is exactly what "no photo" means. The generated types model the
        // field as optional rather than nullable, so this is also the only shape that type-checks.
        body: {
          profileImageMediaId: photoId ?? undefined,
          resumeMediaId: resumeId ?? undefined,
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
          <div className="flex items-start gap-4">
            {photoUrl ? (
              // The saved photo, at the size and crop the site actually uses it at — the picker's
              // own thumbnail is a file preview, which is not the same question.
              <Image
                src={photoUrl}
                alt={query.data?.profileImage?.altText || "Profile photo"}
                width={72}
                height={72}
                unoptimized
                className="h-18 w-18 rounded-xl border border-border object-cover"
              />
            ) : null}
            <div className="flex-1">
              <Field label="Profile photo" optional hint="Choose one already uploaded, or upload it here.">
                <MediaPicker value={photoId} onChange={setPhotoId} label="photo" />
              </Field>
            </div>
          </div>

          <Field label="Resume" optional hint="A PDF. Uploads here — no need to visit the library.">
            <MediaPicker
              value={resumeId}
              onChange={setResumeId}
              accept="application/pdf"
              label="resume"
            />
          </Field>
          {resumeUrl ? (
            <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
              Open current resume
            </a>
          ) : null}

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
