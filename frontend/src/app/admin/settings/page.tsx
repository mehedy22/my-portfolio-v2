"use client";

import { SettingsEditor } from "@/app/admin/settings/settings-editor";
import { SocialLinksEditor } from "@/app/admin/settings/social-links-editor";

export default function GeneralSettingsPage() {
  return (
    <div className="flex flex-col gap-10">
      <SettingsEditor title="General settings" path="/api/v1/admin/settings" />
      <SocialLinksEditor />
    </div>
  );
}
