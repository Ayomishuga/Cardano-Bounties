"use client";

import { useState } from "react";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "aanuoluwapo.ay@gmail.com";

export function ContactAdminLink() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(ADMIN_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available (some in-app browsers) — fallback: prompt
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
