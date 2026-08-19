"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { apiBaseUrl } from "@/lib/admin/api";
import { Button, Card, Field, inputClass } from "@/components/admin/ui/primitives";

/** Completing a reset. The token arrives as `?token=` in the emailed link. */
function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // Checked here because only the browser knows what was typed twice; the API sees one value.
    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }

    setSubmitting(true);
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/password-reset/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token, newPassword: password }),
    });
    setSubmitting(false);

    if (response.ok) {
      router.replace("/admin/login?reset=1");
      return;
    }
    const envelope = await response.json().catch(() => null);
    setError(
      envelope?.errors?.[0]?.message ??
        envelope?.message ??
        "That reset link is invalid or has expired.",
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="font-display text-2xl font-semibold">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        {params.get("token") ? null : (
          <Field label="Reset token">
            <input required value={token} onChange={(e) => setToken(e.target.value)} className={inputClass} />
          </Field>
        )}
        <Field label="New password" hint="At least 12 characters.">
          <input
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Confirm new password">
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className={inputClass}
          />
        </Field>

        {error ? (
          <p role="alert" className="text-sm text-warning">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Updating…" : "Update password"}
        </Button>
      </form>
      <p className="mt-6 text-sm">
        <Link href="/admin/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <Suspense fallback={<Card className="w-full max-w-sm">Loading…</Card>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
