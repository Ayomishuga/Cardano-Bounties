import React from "react";
import styles from "./ModalCloseButton.module.css";

export type ModalCloseButtonProps = {
  onClose: () => void;
  className?: string;
  label?: string;
  size?: number;
};

/**
 * Shared modal close "X" button component.
 */
export function ModalCloseButton({
  onClose,
  className = "",
  label = "Close modal",
  size = 18,
}: ModalCloseButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.closeBtn} ${className}`.trim()}
      onClick={onClose}
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
