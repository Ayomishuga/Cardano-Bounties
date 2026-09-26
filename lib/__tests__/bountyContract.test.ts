import { describe, it, expect } from "vitest";
import {
  validateCreateBountyPayload,
  validateEscrowPayload,
  computeEqualSplitLovelace,
  getFundingBreakdown,
  BOUNTY_STATUS,
  PAYOUT_TYPE,
  LOVELACE_PER_ADA,
  MIN_TITLE_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MIN_INSTRUCTIONS_LENGTH,
  MAX_INSTRUCTIONS_LENGTH,
  MAX_REWARD_ADA,
  MAX_WINNERS,
} from "@/lib/bountyContract";

// ---------------------------------------------------------------------------
// Helper to build a valid payload then override specific fields
// ---------------------------------------------------------------------------
function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Fix the staking reward calculator bug",
    description: "A".repeat(MIN_DESCRIPTION_LENGTH),
    type: "development",
    custom_type: null,
    reward_amount: 100,
    deadline: null,
    project_id: null,
    project_name: null,
    project_logo_url: null,
    bounty_instructions: "B".repeat(MIN_INSTRUCTIONS_LENGTH),
    payout_type: "single",
    max_winners: 1,
    prize_structure: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateCreateBountyPayload
// ---------------------------------------------------------------------------
describe("validateCreateBountyPayload", () => {
  it("accepts a valid minimal payload", () => {
    const result = validateCreateBountyPayload(validPayload());
    expect(result.ok).toBe(true);
  });

  it("rejects non-object body", () => {
    const result = validateCreateBountyPayload("not an object");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("JSON object");
  });

  it("rejects null body", () => {
    const result = validateCreateBountyPayload(null);
    expect(result.ok).toBe(false);
  });

  // ── Title ──
  it("rejects missing title", () => {
    const result = validateCreateBountyPayload(validPayload({ title: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("title");
  });

  it("rejects title shorter than MIN_TITLE_LENGTH", () => {
    const result = validateCreateBountyPayload(validPayload({ title: "Ab" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("title");
  });

  it("rejects title longer than MAX_TITLE_LENGTH", () => {
    const result = validateCreateBountyPayload(
      validPayload({ title: "X".repeat(MAX_TITLE_LENGTH + 1) })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("title");
  });

  // ── Type ──
  it("rejects missing type", () => {
    const result = validateCreateBountyPayload(validPayload({ type: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("type");
  });

  it("rejects unsupported type", () => {
    const result = validateCreateBountyPayload(validPayload({ type: "gaming" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("type");
  });

  it("rejects type 'other' without custom_type", () => {
    const result = validateCreateBountyPayload(
      validPayload({ type: "other", custom_type: null })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("custom_type");
  });

  it("accepts type 'other' with valid custom_type", () => {
    const result = validateCreateBountyPayload(
      validPayload({ type: "other", custom_type: "Governance tooling" })
    );
    expect(result.ok).toBe(true);
  });

  // ── Description ──
  it("rejects description shorter than minimum", () => {
    const result = validateCreateBountyPayload(
      validPayload({ description: "Too short" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("description");
  });

  it("rejects description longer than maximum", () => {
    const result = validateCreateBountyPayload(
      validPayload({ description: "D".repeat(MAX_DESCRIPTION_LENGTH + 1) })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("description");
  });

  // ── Instructions ──
  it("rejects instructions shorter than minimum", () => {
    const result = validateCreateBountyPayload(
      validPayload({ bounty_instructions: "Short" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("bounty_instructions");
  });

  it("rejects instructions longer than maximum", () => {
    const result = validateCreateBountyPayload(
      validPayload({ bounty_instructions: "I".repeat(MAX_INSTRUCTIONS_LENGTH + 1) })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("bounty_instructions");
  });

  // ── Reward ──
  it("rejects reward_amount of 0", () => {
    const result = validateCreateBountyPayload(validPayload({ reward_amount: 0 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("reward_amount");
  });

  it("rejects negative reward_amount", () => {
    const result = validateCreateBountyPayload(validPayload({ reward_amount: -50 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("reward_amount");
  });

  it("rejects reward_amount exceeding MAX_REWARD_ADA", () => {
    const result = validateCreateBountyPayload(
      validPayload({ reward_amount: MAX_REWARD_ADA + 1 })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("reward_amount");
  });

  it("rejects reward_amount with more than 2 decimal places", () => {
    const result = validateCreateBountyPayload(
      validPayload({ reward_amount: 10.123 })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("reward_amount");
  });

  // ── Fee verification ──
  it("rejects mismatched platform_fee_amount", () => {
    const result = validateCreateBountyPayload(
      validPayload({ reward_amount: 100, platform_fee_amount: 5 })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("platform_fee_amount");
  });

  it("rejects mismatched total_funding_amount", () => {
    const result = validateCreateBountyPayload(
      validPayload({ reward_amount: 100, total_funding_amount: 999 })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("total_funding_amount");
  });

  it("accepts correct platform_fee_amount and total_funding_amount", () => {
    const result = validateCreateBountyPayload(
      validPayload({
        reward_amount: 100,
        platform_fee_amount: 10,
        total_funding_amount: 110,
      })
    );
    expect(result.ok).toBe(true);
  });

  // ── Deadline ──
  it("rejects a past deadline", () => {
    const result = validateCreateBountyPayload(
      validPayload({ deadline: "2020-01-01" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("deadline");
  });

  it("rejects an invalid date format", () => {
    const result = validateCreateBountyPayload(
      validPayload({ deadline: "not-a-date" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("deadline");
  });

  it("accepts null deadline (open-ended)", () => {
    const result = validateCreateBountyPayload(validPayload({ deadline: null }));
    expect(result.ok).toBe(true);
  });

  // ── Project logo URL ──
  it("rejects non-HTTP project_logo_url", () => {
    const result = validateCreateBountyPayload(
      validPayload({ project_logo_url: "ftp://bad.com/logo.png" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("project_logo_url");
  });

  // ── Payout type constraints ──
  it("rejects single payout with max_winners > 1", () => {
    const result = validateCreateBountyPayload(
      validPayload({ payout_type: "single", max_winners: 3 })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("max_winners");
  });

  it("rejects equal_split with max_winners < 2", () => {
    const result = validateCreateBountyPayload(
      validPayload({ payout_type: "equal_split", max_winners: 1 })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("max_winners");
  });

  it("rejects max_winners exceeding MAX_WINNERS", () => {
    const result = validateCreateBountyPayload(
      validPayload({ payout_type: "equal_split", max_winners: MAX_WINNERS + 1 })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("max_winners");
  });

  it("accepts valid equal_split payout", () => {
    const result = validateCreateBountyPayload(
      validPayload({ payout_type: "equal_split", max_winners: 3 })
    );
    expect(result.ok).toBe(true);
  });

  // ── Manual split prize_structure ──
  it("rejects manual_split with wrong prize_structure length", () => {
    const result = validateCreateBountyPayload(
      validPayload({
        payout_type: "manual_split",
        max_winners: 2,
        prize_structure: [{ rank: 1, amount_lovelace: 100_000_000 }],
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("prize_structure");
  });

  it("rejects manual_split with prize_structure sum ≠ reward", () => {
    const result = validateCreateBountyPayload(
      validPayload({
        payout_type: "manual_split",
        max_winners: 2,
        prize_structure: [
          { rank: 1, amount_lovelace: 50_000_000 },
          { rank: 2, amount_lovelace: 10_000_000 },
        ],
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("prize_structure");
  });

  it("rejects manual_split with duplicate ranks", () => {
    const result = validateCreateBountyPayload(
      validPayload({
        payout_type: "manual_split",
        max_winners: 2,
        prize_structure: [
          { rank: 1, amount_lovelace: 60_000_000 },
          { rank: 1, amount_lovelace: 40_000_000 },
        ],
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("prize_structure");
  });

  it("accepts valid manual_split with correct prize_structure", () => {
    const result = validateCreateBountyPayload(
      validPayload({
        payout_type: "manual_split",
        max_winners: 2,
        prize_structure: [
          { rank: 1, amount_lovelace: 60_000_000 },
          { rank: 2, amount_lovelace: 40_000_000 },
        ],
      })
    );
    expect(result.ok).toBe(true);
  });

  // ── Output shape ──
  it("returns server-authoritative fee amounts on success", () => {
    const result = validateCreateBountyPayload(validPayload({ reward_amount: 200 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.reward_amount).toBe(200);
      expect(result.value.platform_fee_amount).toBe(20);
      expect(result.value.total_funding_amount).toBe(220);
    }
  });
});

// ---------------------------------------------------------------------------
// validateEscrowPayload
// ---------------------------------------------------------------------------
describe("validateEscrowPayload", () => {
  const validTxHash = "a".repeat(64);

  it("accepts valid escrow payload", () => {
    const result = validateEscrowPayload(
      { escrow_tx_hash: validTxHash, escrow_address: "addr_test1abc" },
      "addr_test1abc"
    );
    expect(result.ok).toBe(true);
  });

  it("rejects missing tx hash", () => {
    const result = validateEscrowPayload(
      { escrow_tx_hash: "", escrow_address: "addr_test1abc" },
      undefined
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("escrow_tx_hash");
  });

  it("rejects invalid hex tx hash", () => {
    const result = validateEscrowPayload(
      { escrow_tx_hash: "not-valid-hex", escrow_address: "addr_test1abc" },
      undefined
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("escrow_tx_hash");
  });

  it("rejects mismatched escrow address", () => {
    const result = validateEscrowPayload(
      { escrow_tx_hash: validTxHash, escrow_address: "addr_test1wrong" },
      "addr_test1expected"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("escrow_address");
  });

  it("accepts transaction_hash as alias for escrow_tx_hash", () => {
    const result = validateEscrowPayload(
      { transaction_hash: validTxHash, escrow_address: "addr_test1abc" },
      undefined
    );
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeEqualSplitLovelace
// ---------------------------------------------------------------------------
describe("computeEqualSplitLovelace", () => {
  it("splits evenly with no remainder", () => {
    const result = computeEqualSplitLovelace(10, 2);
    expect(result).toEqual([BigInt(5_000_000), BigInt(5_000_000)]);
  });

  it("gives remainder to rank 1 (index 0)", () => {
    const result = computeEqualSplitLovelace(10, 3);
    const base = BigInt(10_000_000) / BigInt(3);
    const remainder = BigInt(10_000_000) % BigInt(3);
    expect(result[0]).toBe(base + remainder);
    expect(result[1]).toBe(base);
    expect(result[2]).toBe(base);
    // Sum must equal total
    expect(result.reduce((a, b) => a + b, BigInt(0))).toBe(BigInt(10_000_000));
  });

  it("handles single winner", () => {
    const result = computeEqualSplitLovelace(100, 1);
    expect(result).toEqual([BigInt(100_000_000)]);
  });
});

// ---------------------------------------------------------------------------
// getFundingBreakdown
// ---------------------------------------------------------------------------
describe("getFundingBreakdown", () => {
  it("computes 10% platform fee", () => {
    const { reward, platformFee, totalFunding } = getFundingBreakdown(100);
    expect(reward).toBe(100);
    expect(platformFee).toBe(10);
    expect(totalFunding).toBe(110);
  });

  it("handles small amounts with rounding", () => {
    const { reward, platformFee, totalFunding } = getFundingBreakdown(1);
    expect(reward).toBe(1);
    expect(platformFee).toBe(0.1);
    expect(totalFunding).toBe(1.1);
  });

  it("maintains equation: totalFunding = reward + platformFee", () => {
    const amounts = [0.01, 0.5, 1, 10, 100, 999.99, 1000];
    for (const amount of amounts) {
      const { reward, platformFee, totalFunding } = getFundingBreakdown(amount);
      // Use rounding to avoid floating point comparison issues
      expect(Math.round(totalFunding * 1e6)).toBe(
        Math.round((reward + platformFee) * 1e6)
      );
    }
  });
});
