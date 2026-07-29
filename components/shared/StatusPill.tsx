import React from "react";
import { normalizeStatus } from "@/lib/formatters";
import styles from "./StatusPill.module.css";

type StatusPillProps = {
  status: string | null | undefined;
  className?: string;
};

/**
 * Shared Status Pill badge component for consistent status styling.
 */
export function StatusPill({ status, className = "" }: StatusPillProps) {
  const normalized = normalizeStatus(status || "unknown");
  const rawStatus = (status || "unknown").toLowerCase();

  return (
    <span className={`${styles.pill} ${className}`} data-status={rawStatus}>
      {normalized}
    </span>
  );
}
