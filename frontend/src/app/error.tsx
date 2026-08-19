"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
      {/* Never renders the raw error: NFR-05's discipline extends to the frontend. */}
      <p className="mt-3 text-muted">This page could not be loaded.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
