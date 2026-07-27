/**
 * Display-layer formatting helpers.
 *
 * Pure functions only — no React, no API calls, no business logic.
 * Every function answers the question: "how do we show this raw value to a human?"
 *
 * Import these instead of copy-pasting formatter functions into page components.
 */

// ---------------------------------------------------------------------------
// ADA / lovelace formatting
// ---------------------------------------------------------------------------

/**
 * Formats an ADA value (as a number or string) for display.
 * Returns "Reward TBD" for null/undefined/empty values.
 *
 * @example formatAda(1500) → "1,500 ADA"
 * @example formatAda(null) → "Reward TBD"
 */
export function formatAda(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Reward TBD";
  const amount = Number(value);
  if (Number.isNaN(amount)) return `${value} ADA`;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(amount)} ADA`;
}

/**
 * Converts a lovelace integer to an ADA display string.
 *
 * @example formatLovelaceAsAda(5000000) → "5 ADA"
 * @example formatLovelaceAsAda(1500000) → "1.5 ADA"
 */
export function formatLovelaceAsAda(value: number | null | undefined): string {
  return formatAda(Number(value ?? 0) / 1_000_000);
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/**
 * Formats a date string as "Jul 22, 2026". Returns "Not set" for invalid dates.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Same as formatDate but with the time component appended ("Jul 22, 2026, 02:30 PM").
 * Returns "Not recorded" for invalid or missing dates.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Returns a human-friendly relative time string ("3h ago", "2d ago", "Just now").
 * Returns "Not recorded" for invalid or missing dates.
 *
 * @example formatRelativeTime("2026-07-22T10:00:00Z") → "4h ago"
 */
export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ---------------------------------------------------------------------------
// Status formatting
// ---------------------------------------------------------------------------

/**
 * Converts a snake_case status string to Title Case for display.
 *
 * @example normalizeStatus("in_review") → "In Review"
 * @example normalizeStatus(null) → "Pending"
 */
export function normalizeStatus(value: string | null | undefined): string {
  if (!value) return "Pending";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// ---------------------------------------------------------------------------
// Identity / address formatting
// ---------------------------------------------------------------------------

/**
 * Truncates a long ID or address to a readable short form.
 * Values of 16 chars or fewer are returned unchanged.
 *
 * @example shortId("stake1ux9abc...xyz789") → "stake1ux9...xyz789"
 */
export function shortId(
  value: string | null | undefined,
  headLen = 8,
  tailLen = 6,
): string {
  if (!value) return "Unknown";
  if (value.length <= headLen + tailLen) return value;
  return `${value.slice(0, headLen)}...${value.slice(-tailLen)}`;
}

/**
 * Returns up to 2 uppercase initials from a display name or identifier.
 * Returns "?" for null/undefined/empty values.
 *
 * @example getInitials("Alice") → "AL"
 * @example getInitials(null) → "?"
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Deadline helpers
// ---------------------------------------------------------------------------

/**
 * Returns a deadline urgency label ("Open", "3d left", "Due today", "Reviewing").
 */
export function getDeadlineState(value: string | null): string {
  if (!value) return "Open";
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return "Open";

  const days = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "Reviewing";
  if (days === 0) return "Due today";
  if (days <= 7) return `${days}d left`;
  return "Open";
}

/**
 * Returns true when a given timestamp is older than the supplied number of hours.
 */
export function isOlderThanHours(value: string | null | undefined, hours: number): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() > hours * 60 * 60 * 1000;
}
