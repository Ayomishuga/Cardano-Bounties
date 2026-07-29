"use client";

import React, { useState } from "react";
import styles from "./CopyButton.module.css";

type CopyButtonProps = {
  value: string;
  label?: string;
  className?: string;
};

/**
 * Reusable copy-to-clipboard button with visual confirmation feedback.
 */
export function CopyButton({ value, label = "Copy", className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  return (
    <button
      type="button"
      className={`${styles.button} ${copied ? styles.copied : ""} ${className}`}
      onClick={handleCopy}
      title={`Copy ${value}`}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
