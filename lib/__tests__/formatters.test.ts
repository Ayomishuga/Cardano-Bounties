import { describe, it, expect } from "vitest";
import {
  formatAda,
  formatLovelaceAsAda,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  normalizeStatus,
  shortId,
  getInitials,
  isValidUrl,
  isOlderThanHours,
} from "@/lib/formatters";

// ---------------------------------------------------------------------------
// formatAda
// ---------------------------------------------------------------------------
describe("formatAda", () => {
  it("returns 'Reward TBD' for null", () => {
    expect(formatAda(null)).toBe("Reward TBD");
  });

  it("returns 'Reward TBD' for undefined", () => {
    expect(formatAda(undefined)).toBe("Reward TBD");
  });

  it("returns 'Reward TBD' for empty string", () => {
    expect(formatAda("")).toBe("Reward TBD");
  });

  it("formats a whole number with commas", () => {
    expect(formatAda(1500)).toBe("1,500 ADA");
  });

  it("formats a decimal number", () => {
    expect(formatAda(1.5)).toBe("1.5 ADA");
  });

  it("formats zero", () => {
    expect(formatAda(0)).toBe("0 ADA");
  });

  it("passes through NaN strings with ADA suffix", () => {
    expect(formatAda("not-a-number")).toBe("not-a-number ADA");
  });

  it("handles string numbers", () => {
    expect(formatAda("250")).toBe("250 ADA");
  });
});

// ---------------------------------------------------------------------------
// formatLovelaceAsAda
// ---------------------------------------------------------------------------
describe("formatLovelaceAsAda", () => {
  it("converts 5000000 lovelace to 5 ADA", () => {
    expect(formatLovelaceAsAda(5_000_000)).toBe("5 ADA");
  });

  it("converts 1500000 lovelace to 1.5 ADA", () => {
    expect(formatLovelaceAsAda(1_500_000)).toBe("1.5 ADA");
  });

  it("handles null as 0 ADA", () => {
    expect(formatLovelaceAsAda(null)).toBe("0 ADA");
  });

  it("handles undefined as 0 ADA", () => {
    expect(formatLovelaceAsAda(undefined)).toBe("0 ADA");
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe("formatDate", () => {
  it("formats a valid ISO date", () => {
    const result = formatDate("2026-07-22T00:00:00Z");
    expect(result).toContain("2026");
    expect(result).toContain("22");
  });

  it("returns 'Not set' for null", () => {
    expect(formatDate(null)).toBe("Not set");
  });

  it("returns 'Not set' for undefined", () => {
    expect(formatDate(undefined)).toBe("Not set");
  });

  it("returns 'Not set' for garbage string", () => {
    expect(formatDate("not-a-date")).toBe("Not set");
  });
});

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------
describe("formatDateTime", () => {
  it("includes time component for valid date", () => {
    const result = formatDateTime("2026-07-22T14:30:00Z");
    expect(result).toContain("2026");
  });

  it("returns 'Not recorded' for null", () => {
    expect(formatDateTime(null)).toBe("Not recorded");
  });
});

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------
describe("formatRelativeTime", () => {
  it("returns 'Not recorded' for null", () => {
    expect(formatRelativeTime(null)).toBe("Not recorded");
  });

  it("returns 'Not recorded' for undefined", () => {
    expect(formatRelativeTime(undefined)).toBe("Not recorded");
  });

  it("returns 'Just now' for very recent timestamps", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("Just now");
  });

  it("returns minutes ago for timestamps within the hour", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(formatRelativeTime(tenMinAgo)).toBe("10m ago");
  });

  it("returns hours ago for timestamps within the day", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days ago for timestamps within the month", () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveDaysAgo)).toBe("5d ago");
  });
});

// ---------------------------------------------------------------------------
// normalizeStatus
// ---------------------------------------------------------------------------
describe("normalizeStatus", () => {
  it("converts snake_case to Title Case", () => {
    expect(normalizeStatus("in_review")).toBe("In Review");
  });

  it("converts single word", () => {
    expect(normalizeStatus("pending")).toBe("Pending");
  });

  it("handles multi-word snake_case", () => {
    expect(normalizeStatus("awaiting_admin_review")).toBe("Awaiting Admin Review");
  });

  it("returns 'Pending' for null", () => {
    expect(normalizeStatus(null)).toBe("Pending");
  });

  it("returns 'Pending' for undefined", () => {
    expect(normalizeStatus(undefined)).toBe("Pending");
  });
});

// ---------------------------------------------------------------------------
// shortId
// ---------------------------------------------------------------------------
describe("shortId", () => {
  it("returns full value if 14 chars or less", () => {
    expect(shortId("short_id")).toBe("short_id");
  });

  it("truncates long values with ellipsis", () => {
    const long = "stake1ux9abcdefghijklmnopqrstuvwxyz789";
    const result = shortId(long);
    expect(result).toContain("...");
    expect(result.length).toBeLessThan(long.length);
  });

  it("returns 'Unknown' for null", () => {
    expect(shortId(null)).toBe("Unknown");
  });

  it("returns 'Unknown' for undefined", () => {
    expect(shortId(undefined)).toBe("Unknown");
  });

  it("respects custom head and tail lengths", () => {
    const value = "abcdefghijklmnopqrstuvwxyz";
    const result = shortId(value, 4, 4);
    expect(result).toBe("abcd...wxyz");
  });
});

// ---------------------------------------------------------------------------
// getInitials
// ---------------------------------------------------------------------------
describe("getInitials", () => {
  it("returns first 2 uppercase chars", () => {
    expect(getInitials("Alice")).toBe("AL");
  });

  it("returns '?' for null", () => {
    expect(getInitials(null)).toBe("?");
  });

  it("returns '?' for undefined", () => {
    expect(getInitials(undefined)).toBe("?");
  });

  it("handles single character name", () => {
    expect(getInitials("A")).toBe("A");
  });
});

// ---------------------------------------------------------------------------
// isValidUrl
// ---------------------------------------------------------------------------
describe("isValidUrl", () => {
  it("accepts https URL", () => {
    expect(isValidUrl("https://github.com/example")).toBe(true);
  });

  it("accepts http URL", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
  });

  it("rejects ftp URL", () => {
    expect(isValidUrl("ftp://bad.com")).toBe(false);
  });

  it("rejects garbage string", () => {
    expect(isValidUrl("not a url")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidUrl("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isOlderThanHours
// ---------------------------------------------------------------------------
describe("isOlderThanHours", () => {
  it("returns true for timestamps older than threshold", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(isOlderThanHours(old, 24)).toBe(true);
  });

  it("returns false for recent timestamps", () => {
    const recent = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    expect(isOlderThanHours(recent, 24)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isOlderThanHours(null, 24)).toBe(false);
  });
});
