"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "portfolio-theme";

/**
 * Light / dark / follow-the-system (Sprint 11, COULD tier).
 *
 * <p>"System" is a real third state, not the absence of a choice: a reader who has never touched
 * this gets their OS preference, and a reader who picks light on a dark-mode machine keeps light.
 * The choice is stored in localStorage — it is a display preference, not personal data, and it
 * never leaves the browser.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme((localStorage.getItem(STORAGE_KEY) as Theme) ?? "system");
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
      localStorage.removeItem(STORAGE_KEY);
    } else {
      root.setAttribute("data-theme", theme);
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme, mounted]);

  // Rendered only after mount: the server cannot know the reader's stored choice, and rendering a
  // guess would flash the wrong state on load.
  if (!mounted) return <div className="h-8" aria-hidden />;

  const options: { value: Theme; label: string; icon: string }[] = [
    { value: "light", label: "Light", icon: "☀" },
    { value: "system", label: "System", icon: "◐" },
    { value: "dark", label: "Dark", icon: "☾" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex gap-1 rounded-full border border-border p-1"
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
