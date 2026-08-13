"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import styles from "./ThemeToggle.module.css";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className={`${styles.toggle}${className ? ` ${className}` : ""}`}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      onClick={toggleTheme}
    >
      <Sun className={styles.sunIcon} size={17} strokeWidth={2.2} aria-hidden="true" />
      <Moon className={styles.moonIcon} size={17} strokeWidth={2.2} aria-hidden="true" />
      <span className={styles.knob} aria-hidden="true" />
    </button>
  );
}
