import React from "react";
import { normalizeStatus } from "@/lib/formatters";
import styles from "./StatusPill.module.css";

export function resolveStatusKey(status: string | null | undefined): string {
  if (!status) return "unknown";
  const raw = status.trim().toLowerCase();
  const key = raw.replace(/\s+/g, "_");
  if (key === "open" || key === "committed") return "approved";
  if (key === "needs_payment") return "warning";
  if (key === "needs_review") return "danger";
  return key;
}

export type StatusPillProps = {
  status: string | null | undefined;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Shared Status Pill badge component for consistent status styling across dashboards and modals.
 */
export function StatusPill({ status, label, className = "", style }: StatusPillProps) {
  const statusKey = resolveStatusKey(status);
  const displayLabel = label ?? normalizeStatus(status || "unknown");

  return (
    <span
      className={`${styles.pill} ${className}`.trim()}
      data-status={statusKey}
      style={style}
    >
      {displayLabel}
    </span>
  );
}
