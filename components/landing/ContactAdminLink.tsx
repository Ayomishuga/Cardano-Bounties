"use client";

import { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "aanuoluwapo.ay@gmail.com";

export function ContactAdminLink() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    const success = await copyToClipboard(ADMIN_EMAIL);
    if (success) {
      setCopied(true);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } else {
      window.prompt("Copy this email address:", ADMIN_EMAIL);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Contact: ${ADMIN_EMAIL}`}
    >
      {copied ? "✓ Email copied!" : "Contact Admin"}
    </button>
  );
}
