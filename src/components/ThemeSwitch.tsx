"use client";

// Light / Dark / Auto switch. "Auto" follows the computer or phone's own
// setting. The choice is saved in a cookie for a year, so the server can draw
// the page in the right colours straight away (no white flash).

import { useState } from "react";

export type Theme = "light" | "dark" | "auto";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto" },
];

export function ThemeSwitch({ initial, className = "" }: { initial: Theme; className?: string }) {
  const [theme, setTheme] = useState<Theme>(initial);

  function choose(next: Theme) {
    setTheme(next);
    const root = document.documentElement;
    if (next === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className={`theme-switch ${className}`} role="group" aria-label="Colour theme">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" aria-pressed={theme === o.value} onClick={() => choose(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
