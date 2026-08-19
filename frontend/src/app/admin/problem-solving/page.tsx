"use client";

import { ContentScreen, STATUS_OPTIONS, type FieldSpec } from "@/components/admin/ui/content-screen";

/**
 * Judge profiles. The figures are typed, not fetched: nothing here syncs with LeetCode or
 * Codeforces, so what the site claims is what the admin last chose to publish.
 */
const FIELDS: FieldSpec[] = [
  { name: "platform", label: "Platform", required: true, hint: "LeetCode, Codeforces, HackerRank, CodeChef…" },
  { name: "handle", label: "Judge id / handle", required: true },
  { name: "profileUrl", label: "Profile URL", optional: true },
  { name: "problemsSolved", label: "Problems solved", type: "number", optional: true },
  { name: "rating", label: "Rating", type: "number", optional: true },
  { name: "rankTitle", label: "Rank title", optional: true, hint: "The platform's own tier — Knight, Expert, 5 star…" },
  { name: "displayOrder", label: "Display order", type: "number", optional: true },
  { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];

export default function AdminProblemSolvingPage() {
  return (
    <ContentScreen
      title="Problem solving"
      queryKey="problem-solving"
      listPath="/api/v1/admin/problem-solving"
      itemPath="/api/v1/admin/problem-solving/{id}"
      fields={FIELDS}
      emptyMessage="No judge profiles yet — add your first one."
      addLabel="Add profile"
      toRow={(item) => ({
        id: item.id as number,
        title: `${item.platform ?? ""} — @${item.handle ?? ""}`,
        subtitle: [
          item.problemsSolved ? `${item.problemsSolved} solved` : null,
          item.rating ? `rating ${item.rating}` : null,
          item.rankTitle ?? null,
        ]
          .filter(Boolean)
          .join(" · "),
        status: item.status as string,
      })}
      toForm={(item) => ({
        platform: item?.platform ?? "",
        handle: item?.handle ?? "",
        profileUrl: item?.profileUrl ?? null,
        problemsSolved: item?.problemsSolved ?? null,
        rating: item?.rating ?? null,
        rankTitle: item?.rankTitle ?? null,
        displayOrder: item?.displayOrder ?? 0,
        status: item?.status ?? "PUBLISHED",
      })}
    />
  );
}
