"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

/**
 * Theme control.
 *
 * Defaults to `system` and stays there unless the person actually chooses —
 * an app that silently overrides the OS preference is making a decision that
 * was not its to make. A stored choice then wins in both directions, because
 * "I know it's dark out but I want light" is a legitimate thing to want.
 *
 * The class is written by an inline script in the document head (see layout),
 * not here, so the correct theme is painted on the FIRST frame. Doing it in an
 * effect gives every user a flash of the wrong theme on every cold load.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme((localStorage.getItem("ascend-theme") as Theme) ?? "system");
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    if (next === "system") {
      localStorage.removeItem("ascend-theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem("ascend-theme", next);
      document.documentElement.setAttribute("data-theme", next);
    }
  }

  const options: [Theme, string][] = [
    ["light", "Light"],
    ["system", "Auto"],
    ["dark", "Dark"],
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex rounded-pill bg-slope/70 p-hair ring-1 ring-scree/60"
    >
      {options.map(([value, label]) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          onClick={() => choose(value)}
          className={`rounded-pill px-3 py-1.5 text-caption transition duration-150 ease-ascend ${
            theme === value ? "bg-ridge text-snow" : "text-sage hover:text-snow"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
