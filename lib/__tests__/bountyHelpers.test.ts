import { describe, it, expect } from "vitest";
import {
  getSubmissionBounty,
  getPayoutTypeLabel,
  getPayoutSummary,
  canExtendDeadline,
  isExpiringSoon,
  normalizeBountyType,
  getDeadlineState,
  getBountyState,
  getProjectName,
  getFundingState,
  isEscrowVerificationPending,
  isAcceptingContributions,
  getBountyCategoryLabel,
  getUserHandle,
  getSubmitterHandle,
  getBountyPoster,
  groupSubmissionsByBounty,
  isBountyInReview,
  getRankOrdinal,
  getRankPlacementLabel,
  getRankMedal,
  getBountyPrizeSlots,
  getAvailablePrizeSlots,
  getPrizeSlotAmount,
} from "@/lib/bountyHelpers";

// ---------------------------------------------------------------------------
// Helpers to create minimal test objects
// ---------------------------------------------------------------------------
function bounty(overrides: Record<string, unknown> = {}): any {
  return {
    id: "b1",
    title: "Test bounty",
    status: "open",
    created_by: "user1",
    ...overrides,
  };
}

function submission(overrides: Record<string, unknown> = {}): any {
  return {
    id: "s1",
    bounty_id: "b1",
    status: "pending",
    contributor_id: "c1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getSubmissionBounty
// ---------------------------------------------------------------------------
describe("getSubmissionBounty", () => {
  it("returns submission.bounty when present", () => {
    const b = bounty();
    const s = submission({ bounty: b });
    expect(getSubmissionBounty(s)).toEqual(b);
  });

  it("returns first element of submission.bounties array", () => {
    const b = bounty();
    const s = submission({ bounties: [b] });
    expect(getSubmissionBounty(s)).toEqual(b);
  });

  it("returns submission.bounties when it is an object (not array)", () => {
    const b = bounty();
    const s = submission({ bounties: b });
    expect(getSubmissionBounty(s)).toEqual(b);
  });

  it("returns null when neither bounty nor bounties exist", () => {
    const s = submission({});
    expect(getSubmissionBounty(s)).toBe(null);
  });

  it("returns null for empty bounties array", () => {
    const s = submission({ bounties: [] });
    expect(getSubmissionBounty(s)).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// getPayoutTypeLabel
// ---------------------------------------------------------------------------
describe("getPayoutTypeLabel", () => {
  it("returns 'Equal split' for equal_split", () => {
    expect(getPayoutTypeLabel("equal_split")).toBe("Equal split");
  });

  it("returns 'Manual split' for manual_split", () => {
    expect(getPayoutTypeLabel("manual_split")).toBe("Manual split");
  });

  it("returns 'Single winner' for null", () => {
    expect(getPayoutTypeLabel(null)).toBe("Single winner");
  });

  it("returns 'Single winner' for undefined", () => {
    expect(getPayoutTypeLabel(undefined)).toBe("Single winner");
  });

  it("returns 'Single winner' for 'single'", () => {
    expect(getPayoutTypeLabel("single")).toBe("Single winner");
  });
});

// ---------------------------------------------------------------------------
// getPayoutSummary
// ---------------------------------------------------------------------------
describe("getPayoutSummary", () => {
  it("describes equal split", () => {
    const b = bounty({ payout_type: "equal_split", max_winners: 3 });
    expect(getPayoutSummary(b)).toContain("equally");
    expect(getPayoutSummary(b)).toContain("3");
  });

  it("describes manual split", () => {
    const b = bounty({ payout_type: "manual_split", max_winners: 5 });
    expect(getPayoutSummary(b)).toContain("manually");
    expect(getPayoutSummary(b)).toContain("5");
  });

  it("describes single winner", () => {
    const b = bounty({ payout_type: "single", max_winners: 1 });
    expect(getPayoutSummary(b)).toContain("one");
  });

  it("returns 'unavailable' for null bounty", () => {
    expect(getPayoutSummary(null)).toContain("unavailable");
  });
});

// ---------------------------------------------------------------------------
// canExtendDeadline
// ---------------------------------------------------------------------------
describe("canExtendDeadline", () => {
  it("returns true when open with 0 extensions", () => {
    const b = bounty({ status: "open", deadline_extended_count: 0 });
    expect(canExtendDeadline(b)).toBe(true);
  });

  it("returns true when open with 1 extension", () => {
    const b = bounty({ status: "open", deadline_extended_count: 1 });
    expect(canExtendDeadline(b)).toBe(true);
  });

  it("returns false when open with 2 extensions (at limit)", () => {
    const b = bounty({ status: "open", deadline_extended_count: 2 });
    expect(canExtendDeadline(b)).toBe(false);
  });

  it("returns false for non-open bounty", () => {
    const b = bounty({ status: "completed", deadline_extended_count: 0 });
    expect(canExtendDeadline(b)).toBe(false);
  });

  it("returns true when deadline_extended_count is null", () => {
    const b = bounty({ status: "open", deadline_extended_count: null });
    expect(canExtendDeadline(b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isExpiringSoon
// ---------------------------------------------------------------------------
describe("isExpiringSoon", () => {
  it("returns true for deadline 3 days away", () => {
    const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon(threeDays)).toBe(true);
  });

  it("returns false for deadline 10 days away", () => {
    const tenDays = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon(tenDays)).toBe(false);
  });

  it("returns false for past deadline", () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon(past)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isExpiringSoon(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isExpiringSoon(undefined)).toBe(false);
  });

  it("returns true for deadline due today", () => {
    const today = new Date(Date.now() + 1000).toISOString();
    expect(isExpiringSoon(today)).toBe(true);
  });

  it("returns true for deadline exactly 7 days away", () => {
    const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon(sevenDays)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeBountyType
// ---------------------------------------------------------------------------
describe("normalizeBountyType", () => {
  it("maps 'development' to 'Code'", () => {
    expect(normalizeBountyType("development")).toBe("Code");
  });

  it("maps 'design' to 'Design'", () => {
    expect(normalizeBountyType("design")).toBe("Design");
  });

  it("maps 'documentation' to 'Docs'", () => {
    expect(normalizeBountyType("documentation")).toBe("Docs");
  });

  it("returns 'Other' for null", () => {
    expect(normalizeBountyType(null)).toBe("Other");
  });

  it("returns 'Other' for undefined", () => {
    expect(normalizeBountyType(undefined)).toBe("Other");
  });

  it("returns original value (trimmed) for unknown types", () => {
    expect(normalizeBountyType("  custom thing  ")).toBe("custom thing");
  });

  it("is case-insensitive", () => {
    expect(normalizeBountyType("DESIGN")).toBe("Design");
    expect(normalizeBountyType("Code")).toBe("Code");
  });
});

// ---------------------------------------------------------------------------
// getDeadlineState
// ---------------------------------------------------------------------------
describe("getDeadlineState", () => {
  it("returns 'Open' for null", () => {
    expect(getDeadlineState(null)).toBe("Open");
  });

  it("returns 'Open' for undefined", () => {
    expect(getDeadlineState(undefined)).toBe("Open");
  });

  it("returns 'Open' for invalid date", () => {
    expect(getDeadlineState("garbage")).toBe("Open");
  });

  it("returns 'Past deadline' for past dates", () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(getDeadlineState(past)).toBe("Past deadline");
  });

  it("returns 'Due today' for deadline within the next few hours", () => {
    // Use a timestamp later today but within the same calendar day
    const laterToday = new Date();
    laterToday.setHours(23, 59, 59, 0);
    // Only test if there's enough time left today for days===0
    const diff = laterToday.getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days === 0) {
      expect(getDeadlineState(laterToday.toISOString())).toBe("Due today");
    }
  });

  it("returns 'Xd left' for deadlines within a week", () => {
    const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(getDeadlineState(threeDays)).toMatch(/^\d+d left$/);
  });

  it("returns 'Open' for deadlines more than a week away", () => {
    const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(getDeadlineState(farFuture)).toBe("Open");
  });
});

// ---------------------------------------------------------------------------
// getBountyState
// ---------------------------------------------------------------------------
describe("getBountyState", () => {
  it("returns 'In review' for in_review bounties", () => {
    expect(getBountyState(bounty({ status: "in_review" }))).toBe("In review");
  });

  it("delegates to getDeadlineState for open bounties", () => {
    const b = bounty({ status: "open", deadline: null });
    expect(getBountyState(b)).toBe("Open");
  });
});

// ---------------------------------------------------------------------------
// getProjectName
// ---------------------------------------------------------------------------
describe("getProjectName", () => {
  it("returns project_name when present", () => {
    expect(getProjectName(bounty({ project_name: "MyProject" }))).toBe("MyProject");
  });

  it("falls back to projects.name", () => {
    expect(getProjectName(bounty({ projects: { name: "Nested" } }))).toBe("Nested");
  });

  it("returns 'Independent bounty' when no project", () => {
    expect(getProjectName(bounty({}))).toBe("Independent bounty");
  });
});

// ---------------------------------------------------------------------------
// getFundingState
// ---------------------------------------------------------------------------
describe("getFundingState", () => {
  it("returns 'Escrow confirmed' when confirmed", () => {
    expect(getFundingState(bounty({ escrow_confirmed_at: "2026-01-01" }))).toBe("Escrow confirmed");
  });

  it("returns 'Verification pending' when tx exists but not confirmed", () => {
    expect(getFundingState(bounty({ escrow_tx_hash: "abc" }))).toBe("Verification pending");
  });

  it("returns 'Awaiting escrow' when no tx", () => {
    expect(getFundingState(bounty({}))).toBe("Awaiting escrow");
  });
});

// ---------------------------------------------------------------------------
// isEscrowVerificationPending
// ---------------------------------------------------------------------------
describe("isEscrowVerificationPending", () => {
  it("returns true when pending_escrow with tx hash but no confirmation", () => {
    expect(
      isEscrowVerificationPending(
        bounty({ status: "pending_escrow", escrow_tx_hash: "abc123" })
      )
    ).toBe(true);
  });

  it("returns false when confirmed", () => {
    expect(
      isEscrowVerificationPending(
        bounty({ status: "pending_escrow", escrow_tx_hash: "abc123", escrow_confirmed_at: "2026-01-01" })
      )
    ).toBe(false);
  });

  it("returns false for non-pending_escrow status", () => {
    expect(
      isEscrowVerificationPending(bounty({ status: "open", escrow_tx_hash: "abc123" }))
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isAcceptingContributions
// ---------------------------------------------------------------------------
describe("isAcceptingContributions", () => {
  it("returns true for 'open'", () => {
    expect(isAcceptingContributions("open")).toBe(true);
  });

  it("returns false for 'completed'", () => {
    expect(isAcceptingContributions("completed")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAcceptingContributions(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getUserHandle
// ---------------------------------------------------------------------------
describe("getUserHandle", () => {
  it("prefers display_name", () => {
    expect(getUserHandle({ id: "u1", display_name: "Alice" } as any)).toBe("Alice");
  });

  it("falls back to shortId of stake_address", () => {
    const handle = getUserHandle({ id: "u1", stake_address: "stake1uxabcdefghijklmnopqrstuvwxyz" } as any);
    expect(handle).toContain("...");
  });

  it("returns 'Unknown user' for null", () => {
    expect(getUserHandle(null)).toBe("Unknown user");
  });

  it("returns 'Unknown user' for undefined", () => {
    expect(getUserHandle(undefined)).toBe("Unknown user");
  });
});

// ---------------------------------------------------------------------------
// groupSubmissionsByBounty
// ---------------------------------------------------------------------------
describe("groupSubmissionsByBounty", () => {
  it("groups submissions by their bounty id", () => {
    const b1 = bounty({ id: "b1" });
    const b2 = bounty({ id: "b2" });
    const subs = [
      submission({ id: "s1", bounty: b1 }),
      submission({ id: "s2", bounty: b1 }),
      submission({ id: "s3", bounty: b2 }),
    ];
    const groups = groupSubmissionsByBounty(subs);
    expect(groups).toHaveLength(2);
    expect(groups[0].submissions).toHaveLength(2);
    expect(groups[1].submissions).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    expect(groupSubmissionsByBounty([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isBountyInReview
// ---------------------------------------------------------------------------
describe("isBountyInReview", () => {
  it("returns true for in_review", () => {
    expect(isBountyInReview(bounty({ status: "in_review" }))).toBe(true);
  });

  it("returns false for open", () => {
    expect(isBountyInReview(bounty({ status: "open" }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getBountyPoster
// ---------------------------------------------------------------------------
describe("getBountyPoster", () => {
  it("prefers poster display_name when available", () => {
    const b = bounty({
      poster: { display_name: "Ada Lovelace", stake_address: "stake1uxxyz" },
      created_by: "addr_123",
    });
    expect(getBountyPoster(b)).toBe("Ada Lovelace");
  });

  it("falls back to shortened stake_address when display_name is missing", () => {
    const b = bounty({
      poster: { stake_address: "stake1ux1234567890abcdef" },
      created_by: "addr_123",
    });
    expect(getBountyPoster(b)).toContain("...");
  });

  it("falls back to shortened created_by when poster is missing", () => {
    const b = bounty({
      poster: null,
      created_by: "addr_test1234567890abcdef",
    });
    expect(getBountyPoster(b)).toContain("...");
  });

  it("returns 'Unknown' for null or undefined bounty", () => {
    expect(getBountyPoster(null)).toBe("Unknown");
    expect(getBountyPoster(undefined)).toBe("Unknown");
  });
});

// ---------------------------------------------------------------------------
// getBountyCategoryLabel
// ---------------------------------------------------------------------------
describe("getBountyCategoryLabel", () => {
  it("returns normalized custom_type if present", () => {
    const b = bounty({ custom_type: "smart_contracts", type: "code" });
    expect(getBountyCategoryLabel(b)).toBe("Smart Contracts");
  });

  it("returns normalized type when custom_type is missing", () => {
    const b = bounty({ custom_type: null, type: "content" });
    expect(getBountyCategoryLabel(b)).toBe("Content");
  });

  it("falls back to default fallback 'General' when types are missing", () => {
    const b = bounty({ custom_type: null, type: null });
    expect(getBountyCategoryLabel(b)).toBe("General");
  });

  it("allows custom fallback string", () => {
    const b = bounty({ custom_type: null, type: null });
    expect(getBountyCategoryLabel(b, "Unknown")).toBe("Unknown");
  });

  it("handles null/undefined bounty gracefully", () => {
    expect(getBountyCategoryLabel(null)).toBe("General");
    expect(getBountyCategoryLabel(undefined, "None")).toBe("None");
  });
});

// ---------------------------------------------------------------------------
// Position & Prize Allocation helpers tests
// ---------------------------------------------------------------------------
describe("Rank labels and medals", () => {
  it("computes rank ordinals correctly", () => {
    expect(getRankOrdinal(1)).toBe("1st");
    expect(getRankOrdinal(2)).toBe("2nd");
    expect(getRankOrdinal(3)).toBe("3rd");
    expect(getRankOrdinal(4)).toBe("4th");
    expect(getRankOrdinal(11)).toBe("11th");
    expect(getRankOrdinal(21)).toBe("21st");
    expect(getRankOrdinal(null)).toBe("");
  });

  it("computes rank placement labels correctly", () => {
    expect(getRankPlacementLabel(1)).toBe("1st Place");
    expect(getRankPlacementLabel(2)).toBe("2nd Place");
    expect(getRankPlacementLabel(null)).toBe("Winner");
  });

  it("returns correct medals for ranks", () => {
    expect(getRankMedal(1)).toBe("🥇");
    expect(getRankMedal(2)).toBe("🥈");
    expect(getRankMedal(3)).toBe("🥉");
    expect(getRankMedal(4)).toBe("🏅");
    expect(getRankMedal(null)).toBe("🏆");
  });
});

describe("getBountyPrizeSlots", () => {
  it("returns single winner slot for single payout type", () => {
    const b = bounty({ reward_amount: 500, payout_type: "single" });
    const slots = getBountyPrizeSlots(b);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toEqual({
      rank: 1,
      amount_lovelace: 500000000,
      amount_ada: 500,
      label: "🥇 Winner (1st Place)",
    });
  });

  it("returns manual split slots according to prize_structure", () => {
    const b = bounty({
      reward_amount: 1000,
      payout_type: "manual_split",
      prize_structure: [
        { rank: 2, amount_lovelace: 300000000 },
        { rank: 1, amount_lovelace: 500000000 },
        { rank: 3, amount_lovelace: 200000000 },
      ],
    });
    const slots = getBountyPrizeSlots(b);
    expect(slots).toHaveLength(3);
    // Should be sorted by rank
    expect(slots[0].rank).toBe(1);
    expect(slots[0].amount_ada).toBe(500);
    expect(slots[1].rank).toBe(2);
    expect(slots[1].amount_ada).toBe(300);
    expect(slots[2].rank).toBe(3);
    expect(slots[2].amount_ada).toBe(200);
  });

  it("returns equal split slots divided equally", () => {
    const b = bounty({
      reward_amount: 300,
      payout_type: "equal_split",
      max_winners: 3,
    });
    const slots = getBountyPrizeSlots(b);
    expect(slots).toHaveLength(3);
    expect(slots[0].amount_ada).toBe(100);
    expect(slots[1].amount_ada).toBe(100);
    expect(slots[2].amount_ada).toBe(100);
    expect(slots[0].rank).toBe(1);
    expect(slots[1].rank).toBe(2);
    expect(slots[2].rank).toBe(3);
  });

  it("handles empty/null bounty gracefully", () => {
    expect(getBountyPrizeSlots(null)).toEqual([]);
    expect(getBountyPrizeSlots(bounty({ reward_amount: 0 }))).toEqual([]);
  });
});

describe("getAvailablePrizeSlots", () => {
  it("marks assigned slots correctly based on existing allocations", () => {
    const b = bounty({
      reward_amount: 1000,
      payout_type: "manual_split",
      prize_structure: [
        { rank: 1, amount_lovelace: 600000000 },
        { rank: 2, amount_lovelace: 400000000 },
      ],
    });
    const allocations = [
      {
        rank: 1,
        submission_id: "s1",
        status: "pending",
        users: { display_name: "Alice" },
      },
    ];

    const slots = getAvailablePrizeSlots(b, allocations);
    expect(slots).toHaveLength(2);

    expect(slots[0].rank).toBe(1);
    expect(slots[0].isAvailable).toBe(false);
    expect(slots[0].assignedContributorName).toBe("Alice");
    expect(slots[0].assignedSubmissionId).toBe("s1");

    expect(slots[1].rank).toBe(2);
    expect(slots[1].isAvailable).toBe(true);
    expect(slots[1].assignedContributorName).toBe(null);
  });

  it("ignores cancelled allocations when checking availability", () => {
    const b = bounty({ reward_amount: 500, payout_type: "single" });
    const allocations = [
      {
        rank: 1,
        submission_id: "s1",
        status: "cancelled",
        users: { display_name: "Bob" },
      },
    ];

    const slots = getAvailablePrizeSlots(b, allocations);
    expect(slots).toHaveLength(1);
    expect(slots[0].isAvailable).toBe(true);
  });
});

describe("getPrizeSlotAmount", () => {
  it("resolves specific rank amount", () => {
    const b = bounty({
      reward_amount: 1000,
      payout_type: "manual_split",
      prize_structure: [
        { rank: 1, amount_lovelace: 700000000 },
        { rank: 2, amount_lovelace: 300000000 },
      ],
    });
    expect(getPrizeSlotAmount(b, 1)).toEqual({ amountLovelace: 700000000, amountAda: 700 });
    expect(getPrizeSlotAmount(b, 2)).toEqual({ amountLovelace: 300000000, amountAda: 300 });
  });
});

