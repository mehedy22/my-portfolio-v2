"use client";

import { SettingsEditor } from "@/app/admin/settings/settings-editor";

export default function SeoSettingsPage() {
  return <SettingsEditor title="SEO defaults" path="/api/v1/admin/settings/seo" />;
}
