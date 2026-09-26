"use client";

import React, { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";

export type CopyIconButtonProps = {
  text: string;
  label?: string;
  className?: string;
  copiedDuration?: number;
  onCopy?: (success: boolean) => void;
};

/**
 * Reusable icon-only copy button with automatic reset, safe fallback,
 * and memory-safe unmount cleanup.
 */
export function CopyIconButton({
  text,
  label = "Copy to clipboard",
  className = "",
  copiedDuration = 1500,
  onCopy,
}: CopyIconButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function handleCopy(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const success = await copyToClipboard(text);

    if (success) {
      setCopied(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setCopied(false);
      }, copiedDuration);
    }

    onCopy?.(success);
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={copied ? "Copied!" : label}
      aria-live="polite"
      title={copied ? "Copied!" : label}
      data-copied={copied}
      onClick={handleCopy}
    >
      {copied ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}
