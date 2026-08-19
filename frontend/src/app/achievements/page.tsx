import type { Metadata } from "next";
import Image from "next/image";
import { mediaUrl } from "@/lib/api";
import { getAchievements } from "@/lib/content";
import { TrackPageView } from "@/components/track-page-view";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Achievements",
  description: "Awards and recognition.",
  alternates: { canonical: "/achievements" },
};

export default async function AchievementsPage() {
  const achievements = await getAchievements();

  return (
    <div className="mx-auto max-w-3xl">
      <TrackPageView path="/achievements" />
      <PageHeader title="Achievements" />
      {achievements.length === 0 ? (
        <EmptyState message="Nothing published yet." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {achievements.map((achievement) => {
            const image = mediaUrl(achievement.image?.url);
            return (
              <Card key={achievement.id}>
                {image ? (
                  <Image
                    src={image}
                    alt={achievement.image?.altText || achievement.title || ""}
                    width={480}
                    height={260}
                    unoptimized
                    className="mb-4 h-36 w-full rounded-xl border border-border object-cover"
                  />
                ) : null}
                <h2 className="font-display text-lg font-semibold">{achievement.title}</h2>
                {achievement.achievedOn ? (
                  <p className="mt-1 text-sm text-muted">
                    {new Date(achievement.achievedOn).toLocaleDateString("en-GB", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                ) : null}
                {achievement.description ? (
                  <p className="mt-3 whitespace-pre-line text-sm text-muted">{achievement.description}</p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
