"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "portfolio-theme";

/**
 * Switches between the site's own navy theme and the lighter one.
 *
 * <p>Two states, not three. It used to offer light / dark / follow-the-system, which made sense
 * while light was the design and dark a derived variant. The navy is the design now, so
 * "system" would mean handing half the readers a different-looking site based on a setting that
 * has nothing to do with this one — the choice on offer is simply whether to read it lighter.
 *
 * <p>The choice is stored in localStorage; it is a display preference, not personal data, and it
 * never leaves the browser. Choosing dark clears the entry rather than writing it, so a reader
 * who has never touched this and one who chose the default land on the same markup.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark");
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === "light") {
      root.setAttribute("data-theme", "light");
      localStorage.setItem(STORAGE_KEY, "light");
    } else {
      root.removeAttribute("data-theme");
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [theme, mounted]);

  // Rendered only after mount: the server cannot know the reader's stored choice, and rendering a
  // guess would flash the wrong state on load.
  if (!mounted) return <div className="h-8" aria-hidden />;

  const options: { value: Theme; label: string; icon: string }[] = [
    { value: "dark", label: "Dark", icon: "☾" },
    { value: "light", label: "Light", icon: "☀" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex w-fit gap-1 rounded-full border border-border p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => setTheme(option.value)}
          className={`h-6 w-8 rounded-full text-xs transition ${
            theme === option.value ? "bg-accent-soft text-accent" : "text-muted hover:text-accent"
          }`}
        >
          <span aria-hidden>{option.icon}</span>
        </button>
      ))}
    </div>
  );
}
