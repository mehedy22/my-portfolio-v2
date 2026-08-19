"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { browserApi } from "@/lib/api";

/**
 * Mirrors the backend's Bean Validation rules (Phase 7) so obvious mistakes are caught before a
 * round-trip — the server still validates, this only saves the visitor a wasted request.
 *
 * <p>`website` is the honeypot (D-023): hidden from humans with CSS, and named plausibly so a bot
 * filling every input it finds walks into it. A real person never sees or fills it.
 */
const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(200),
  email: z.string().trim().min(1, "Please enter your email").email("That does not look like an email address").max(255),
  subject: z.string().trim().max(300).optional(),
  message: z.string().trim().min(1, "Please enter a message").max(5000),
  website: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sent" | "error" | "throttled">("idle");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { website: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setStatus("idle");
    const { response, error } = await browserApi.POST("/api/v1/contact", { body: values });

    if (response.ok) {
      // Note: a honeypot submission also lands here, by design — the API answers identically so a
      // bot cannot tell the difference (D-023).
      setStatus("sent");
      reset();
      return;
    }
    setStatus(response.status === 429 ? "throttled" : "error");
    if (error) console.error("Contact submission failed", error);
  });

  if (status === "sent") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-border bg-surface p-8 text-center"
      >
        <p className="font-display text-lg font-semibold">Message sent</p>
        <p className="mt-2 text-sm text-muted">Thanks — I will get back to you.</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 rounded-full border border-border px-4 py-2 text-sm transition hover:border-accent hover:text-accent"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Field label="Name" error={errors.name?.message}>
        <input
          {...register("name")}
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          className={inputClass}
        />
      </Field>

      <Field label="Email" error={errors.email?.message}>
        <input
          {...register("email")}
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          className={inputClass}
        />
      </Field>

      <Field label="Subject" error={errors.subject?.message} optional>
        <input {...register("subject")} className={inputClass} />
      </Field>

      <Field label="Message" error={errors.message?.message}>
        <textarea
          {...register("message")}
          rows={6}
          aria-invalid={Boolean(errors.message)}
          className={inputClass}
        />
      </Field>

      {/* Honeypot: hidden from people, offered to bots. Not `type=hidden`, which password
          managers and autofill tend to skip — and tabIndex/aria-hidden keep it away from
          keyboard and screen-reader users. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      {status === "throttled" ? (
        <p role="alert" className="text-sm text-warning">
          Too many messages sent from here. Please try again later.
        </p>
      ) : null}
      {status === "error" ? (
        <p role="alert" className="text-sm text-warning">
          Something went wrong sending your message. Please try again.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-accent";

function Field({
  label,
  error,
  optional,
  children,
}: {
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {optional ? <span className="ml-1 text-xs font-normal text-muted">(optional)</span> : null}
      </span>
      {children}
      {error ? (
        <span role="alert" className="text-xs text-warning">
          {error}
        </span>
      ) : null}
    </label>
  );
}
