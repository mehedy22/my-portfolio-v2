"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/admin/auth-context";
import { Button, Field, inputClass } from "@/components/admin/ui/primitives";

function LoginForm() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const justReset = useSearchParams().get("reset") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // An already-signed-in admin who lands here goes straight through.
  useEffect(() => {
    if (status === "authenticated") router.replace("/admin/projects");
  }, [status, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const failure = await signIn(email, password);
    setSubmitting(false);
    if (failure) {
      setError(failure);
      return;
    }
    router.replace("/admin/projects");
  }

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8"
      >
        <h1 className="font-display text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Portfolio Admin Panel</p>

        {justReset ? (
          <p role="status" className="mt-4 rounded-lg border border-border bg-accent-soft p-3 text-sm">
            Your password has been updated. Sign in with the new one.
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-4">
          <Field label="Email">
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-warning">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={submitting} className="mt-6 w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>

        <p className="mt-4 text-center text-sm">
          <Link href="/admin/forgot-password" className="text-muted hover:text-accent">
            Forgot your password?
          </Link>
        </p>
      </form>
    </div>
  );
}

/** `useSearchParams` needs a Suspense boundary in the App Router. */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
