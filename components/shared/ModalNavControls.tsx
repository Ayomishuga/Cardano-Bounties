import React from "react";
import styles from "./ModalNavControls.module.css";

export type ModalNavControlsProps = {
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  itemLabel?: string;
  className?: string;
};

/**
 * Shared Previous/Next navigation controls for detail modals.
 */
export function ModalNavControls({
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  itemLabel = "item",
  className = "",
}: ModalNavControlsProps) {
  return (
    <div className={`${styles.navControls} ${className}`.trim()}>
      <button
        type="button"
        className={styles.navBtn}
        disabled={!canGoPrev}
        aria-label={`Previous ${itemLabel}`}
        onClick={onPrev}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        type="button"
        className={styles.navBtn}
        disabled={!canGoNext}
        aria-label={`Next ${itemLabel}`}
        onClick={onNext}
      >
        <svg
          width="16"
          height="16"
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
      </button>
    </div>
  );
}
