"use client";

import React, { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    const success = await copyToClipboard(value);
    if (success) {
      setCopied(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => setCopied(false), 2000);
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
