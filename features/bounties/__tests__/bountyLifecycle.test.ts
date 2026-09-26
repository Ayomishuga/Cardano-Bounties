import { describe, it, expect } from "vitest";
import {
  parseDateOnlyUtc,
  isPastDeadline,
  getDeadlineState,
  isAcceptingContributions,
  getEffectiveBountyStatus,
  getBountyLifecycleFields,
  getTodayUtcDateString,
  getTodayUtcDateOnly,
  determinePastDeadlineDisposition,
} from "../domain/bountyLifecycle";

describe("bountyLifecycle domain functions", () => {
  const baseDate = new Date("2026-09-24T12:00:00Z");

  describe("getTodayUtcDateOnly and getTodayUtcDateString", () => {
    it("returns correct UTC string for baseDate", () => {
      expect(getTodayUtcDateString(baseDate)).toBe("2026-09-24");
      expect(getTodayUtcDateOnly(baseDate)).toBe(Date.UTC(2026, 8, 24));
    });
  });

  describe("parseDateOnlyUtc", () => {
    it("parses valid YYYY-MM-DD", () => {
      expect(parseDateOnlyUtc("2026-09-24")).toBe(Date.UTC(2026, 8, 24));
    });

    it("parses valid ISO string with T separator", () => {
      expect(parseDateOnlyUtc("2026-09-24T00:00:00Z")).toBe(Date.UTC(2026, 8, 24));
    });

    it("returns null for invalid dates or garbage", () => {
      expect(parseDateOnlyUtc(null)).toBeNull();
      expect(parseDateOnlyUtc(undefined)).toBeNull();
      expect(parseDateOnlyUtc("")).toBeNull();
      expect(parseDateOnlyUtc("invalid-date")).toBeNull();
      expect(parseDateOnlyUtc("2026-02-30")).toBeNull(); // Feb 30 does not exist
    });
  });

  describe("isPastDeadline", () => {
    it("returns true when deadline is before today", () => {
      expect(isPastDeadline("2026-09-23", baseDate)).toBe(true);
      expect(isPastDeadline("2026-08-01", baseDate)).toBe(true);
    });

    it("returns false when deadline is today", () => {
      expect(isPastDeadline("2026-09-24", baseDate)).toBe(false);
    });

    it("returns false when deadline is in the future", () => {
      expect(isPastDeadline("2026-09-25", baseDate)).toBe(false);
      expect(isPastDeadline("2026-10-01", baseDate)).toBe(false);
    });

    it("returns false when deadline is null or invalid", () => {
      expect(isPastDeadline(null, baseDate)).toBe(false);
      expect(isPastDeadline("invalid", baseDate)).toBe(false);
    });
  });

  describe("getDeadlineState", () => {
    it("returns 'Past deadline' for past dates", () => {
      expect(getDeadlineState("2026-09-20", baseDate)).toBe("Past deadline");
      expect(getDeadlineState("2026-09-23", baseDate)).toBe("Past deadline");
    });

    it("returns 'Due today' for today", () => {
      expect(getDeadlineState("2026-09-24", baseDate)).toBe("Due today");
    });

    it("returns 'Xd left' for deadlines within 7 days", () => {
      expect(getDeadlineState("2026-09-25", baseDate)).toBe("1d left");
      expect(getDeadlineState("2026-09-27", baseDate)).toBe("3d left");
      expect(getDeadlineState("2026-10-01", baseDate)).toBe("7d left");
    });

    it("returns 'Open' for deadlines further than 7 days or null", () => {
      expect(getDeadlineState("2026-10-10", baseDate)).toBe("Open");
      expect(getDeadlineState(null, baseDate)).toBe("Open");
      expect(getDeadlineState("invalid", baseDate)).toBe("Open");
    });
  });

  describe("isAcceptingContributions", () => {
    it("accepts contributions when open and deadline is in the future", () => {
      expect(isAcceptingContributions({ status: "open", deadline: "2026-09-30" }, baseDate)).toBe(true);
      expect(isAcceptingContributions({ status: "open", deadline: "2026-09-24" }, baseDate)).toBe(true);
      expect(isAcceptingContributions({ status: "open", deadline: null }, baseDate)).toBe(true);
    });

    it("rejects contributions when open but past deadline", () => {
      expect(isAcceptingContributions({ status: "open", deadline: "2026-09-20" }, baseDate)).toBe(false);
    });

    it("rejects contributions when status is not open", () => {
      expect(isAcceptingContributions({ status: "in_review", deadline: "2026-09-30" }, baseDate)).toBe(false);
      expect(isAcceptingContributions({ status: "completed", deadline: "2026-09-30" }, baseDate)).toBe(false);
      expect(isAcceptingContributions({ status: "expired", deadline: "2026-09-30" }, baseDate)).toBe(false);
    });
  });

  describe("getEffectiveBountyStatus", () => {
    it("returns 'closed_for_submissions' when status is open but deadline is past", () => {
      expect(getEffectiveBountyStatus({ status: "open", deadline: "2026-09-20" }, baseDate)).toBe("closed_for_submissions");
    });

    it("returns original status when not past deadline", () => {
      expect(getEffectiveBountyStatus({ status: "open", deadline: "2026-09-30" }, baseDate)).toBe("open");
      expect(getEffectiveBountyStatus({ status: "in_review", deadline: "2026-09-20" }, baseDate)).toBe("in_review");
      expect(getEffectiveBountyStatus({ status: "completed", deadline: "2026-09-20" }, baseDate)).toBe("completed");
    });
  });

  describe("getBountyLifecycleFields", () => {
    it("returns all computed fields correctly", () => {
      const activeFields = getBountyLifecycleFields({ status: "open", deadline: "2026-09-27" }, baseDate);
      expect(activeFields).toEqual({
        accepts_contributions: true,
        deadline_state: "3d left",
        effective_status: "open",
      });

      const expiredFields = getBountyLifecycleFields({ status: "open", deadline: "2026-09-20" }, baseDate);
      expect(expiredFields).toEqual({
        accepts_contributions: false,
        deadline_state: "Past deadline",
        effective_status: "closed_for_submissions",
      });
    });
  });

  describe("determinePastDeadlineDisposition", () => {
    it("moves to in_review if there are approved submissions", () => {
      expect(determinePastDeadlineDisposition([{ status: "approved" }])).toBe("in_review");
    });

    it("moves to in_review if there are pending submissions", () => {
      expect(determinePastDeadlineDisposition([{ status: "pending" }])).toBe("in_review");
    });

    it("moves to in_review if there is a mix of pending and rejected submissions", () => {
      expect(determinePastDeadlineDisposition([
        { status: "rejected" },
        { status: "pending" }
      ])).toBe("in_review");
    });

    it("expires if there are no submissions", () => {
      expect(determinePastDeadlineDisposition([])).toBe("expired");
    });

    it("expires if all submissions are rejected", () => {
      expect(determinePastDeadlineDisposition([
        { status: "rejected" },
        { status: "rejected" }
      ])).toBe("expired");
    });
  });
});

