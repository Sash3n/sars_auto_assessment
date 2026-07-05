"use client";

import { useEffect, useState } from "react";
import {
  applyTheme,
  persistTheme,
  resolveInitialTheme,
  type Theme,
} from "@/lib/theme";

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

export default function ThemeToggle() {
  // Theme is unknown until mount: the pre-paint script owns it before then,
  // and reading it during render would mismatch server-rendered HTML.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(resolveInitialTheme());
  }, []);

  const label =
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  function handleToggle() {
    const next: Theme =
      (theme ?? resolveInitialTheme()) === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    persistTheme(next);
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-circle btn-sm"
      onClick={handleToggle}
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
