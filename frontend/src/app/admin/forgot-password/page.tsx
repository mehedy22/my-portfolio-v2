"use client";

import Link from "next/link";
import { useState } from "react";
import { apiBaseUrl } from "@/lib/admin/api";
import { Button, Card, Field, inputClass } from "@/components/admin/ui/primitives";

/**
 * Requesting a reset link (FR-16).
 *
 * <p>The confirmation is deliberately identical whether or not the address is known — the API
 * answers the same way, and echoing anything different here would undo that on the client.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "throttled" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSubmitting(false);
    setState(response.ok ? "sent" : response.status === 429 ? "throttled" : "error");
  }

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <Card className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-semibold">Reset your password</h1>

        {state === "sent" ? (
          <>
            <p className="mt-3 text-sm text-muted">
              If that address is registered, a reset link has been sent. The link is valid for 30
              minutes and can be used once.
            </p>
            <p className="mt-4 rounded-lg border border-border bg-accent-soft p-3 text-xs text-muted">
              No email provider is configured on this deployment yet, so the link is recorded in the
              server log rather than delivered. See OPEN_QUESTIONS #13.
            </p>
          </>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <Field label="Email">
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </Field>

            {state === "throttled" ? (
              <p role="alert" className="text-sm text-warning">
                Too many requests. Please try again later.
              </p>
            ) : null}
            {state === "error" ? (
              <p role="alert" className="text-sm text-warning">
                Something went wrong. Please try again.
              </p>
            ) : null}

            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-sm">
          <Link href="/admin/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
