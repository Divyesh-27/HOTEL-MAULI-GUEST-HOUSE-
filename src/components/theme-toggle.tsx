"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="p-2 rounded-full hover:bg-secondary/80 transition-colors border border-border bg-card"
      title="Toggle theme"
    >
      <Sun className="h-5 w-5 dark:hidden block text-yellow-500" />
      <Moon className="h-5 w-5 hidden dark:block text-slate-300" />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
