"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Submits the term as a query parameter rather than filtering in the browser: the page is rendered
 * on the server, so search must be a URL the server can answer — which also makes a search result
 * a shareable, bookmarkable, crawlable address instead of transient client state.
 */
export function SearchBox({ action, placeholder }: { action: string; placeholder: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [term, setTerm] = useState(params.get("search") ?? "");

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(term.trim() ? `${action}?search=${encodeURIComponent(term.trim())}` : action);
      }}
      className="mb-8 flex gap-2"
    >
      <label className="sr-only" htmlFor="search-term">
        {placeholder}
      </label>
      <input
        id="search-term"
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-accent"
      />
      <button
        type="submit"
        className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
      >
        Search
      </button>
      {term ? (
        <button
          type="button"
          onClick={() => {
            setTerm("");
            router.push(action);
          }}
          className="rounded-xl border border-border px-4 py-2.5 text-sm transition hover:border-accent hover:text-accent"
        >
          Clear
        </button>
      ) : null}
    </form>
  );
}
