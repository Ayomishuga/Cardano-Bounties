import React from "react";
import { getInitials } from "@/lib/formatters";
import styles from "./InitialsAvatar.module.css";

export type InitialsAvatarProps = {
  name?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Shared Initials Avatar circle component.
 */
export function InitialsAvatar({
  name,
  size = "md",
  className = "",
  style,
}: InitialsAvatarProps) {
  const initials = getInitials(name);
  const sizeClass = size === "sm" ? styles.sm : size === "lg" ? styles.lg : "";

  return (
    <div
      className={`${styles.avatar} ${sizeClass} ${className}`.trim()}
      aria-hidden="true"
      style={style}
    >
      {initials}
    </div>
  );
}
