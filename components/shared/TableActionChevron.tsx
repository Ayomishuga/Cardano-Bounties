import React from "react";
import styles from "./DataTable.module.css";

export interface TableActionChevronProps {
  ariaLabel?: string;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  icon?: React.ReactNode;
}

/**
 * Standard action chevron button rendered in table rightmost column.
 */
export function TableActionChevron({
  ariaLabel = "View details",
  className = "",
  onClick,
  icon,
}: TableActionChevronProps) {
  return (
    <div className={`${styles.actions} ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={styles.actionBtn}
        onClick={onClick}
      >
        {icon || (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </button>
    </div>
  );
}
