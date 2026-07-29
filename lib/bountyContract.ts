export const BOUNTY_STATUS = {
  PendingEscrow: "pending_escrow",
  AwaitingAdminReview: "awaiting_admin_review",
  Open: "open",
  InReview: "in_review",
  PayoutPending: "payout_pending",
  PartiallyPaid: "partially_paid",
  Completed: "completed",
  Cancelled: "cancelled",
  Rejected: "rejected",
  Expired: "expired",
} as const;

export const SUBMISSION_STATUS = {
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
  Closed: "closed",
  NotSelected: "not_selected",
  Paid: "paid",
} as const;

export const PAYOUT_TYPE = {
  Single: "single",
  EqualSplit: "equal_split",
  ManualSplit: "manual_split",
} as const;
export type PayoutType = (typeof PAYOUT_TYPE)[keyof typeof PAYOUT_TYPE];

export const ALLOCATION_STATUS = {
  Pending: "pending",
  Processing: "processing",
  Paid: "paid",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;

export const BOUNTY_TYPES = [
  "development",
  "design",
  "content",
  "hackathon",
  "documentation",
  "research",
  "community",
  "security",
  "other",
  "micro-task",
] as const;

export const PLATFORM_FEE_RATE = 0.1;
export const MAX_REWARD_ADA = 1_000_000;
export const MAX_WINNERS = 20;
export const LOVELACE_PER_ADA = 1_000_000;
export const MAX_DEADLINE_EXTENSIONS = 2;
export const MIN_EXTENSION_DAYS = 7;
export const MIN_TITLE_LENGTH = 8;
export const MAX_TITLE_LENGTH = 120;
export const MIN_TYPE_LENGTH = 3;
export const MAX_TYPE_LENGTH = 80;
export const MIN_DESCRIPTION_LENGTH = 40;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MIN_INSTRUCTIONS_LENGTH = 20;
export const MAX_INSTRUCTIONS_LENGTH = 2000;
export const MAX_PROJECT_NAME_LENGTH = 120;

const TX_HASH_PATTERN = /^[0-9a-f]{64}$/i;

export type BountyStatus = (typeof BOUNTY_STATUS)[keyof typeof BOUNTY_STATUS];
export type SubmissionStatus = (typeof SUBMISSION_STATUS)[keyof typeof SUBMISSION_STATUS];
export type BountyType = (typeof BOUNTY_TYPES)[number];

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; field?: string };

export type CreateBountyInput = {
  title: string;
  description: string;
  type: string;
  custom_type: string | null;
  reward_amount: number;
  platform_fee_amount: number;
  total_funding_amount: number;
  deadline: string | null;
  project_id: string | null;
  project_name: string | null;
  project_logo_url: string | null;
  bounty_instructions: string;
  payout_type: PayoutType;
  max_winners: number;
  prize_structure: Array<{ rank: number; amount_lovelace: number }> | null;
};

/**
 * Computes equal-split allocation amounts in lovelace.
 * Uses integer division; remainder lovelace goes to rank 1 (index 0).
 */
export function computeEqualSplitLovelace(rewardAda: number, winners: number): bigint[] {
  const totalLovelace = BigInt(Math.round(rewardAda * LOVELACE_PER_ADA));
  const base = totalLovelace / BigInt(winners);
  const remainder = totalLovelace % BigInt(winners);
  return Array.from({ length: winners }, (_, i) =>
    i === 0 ? base + remainder : base
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isPastDateOnly(value: string) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const [year, month, day] = value.split("-").map(Number);
  const deadlineUtc = Date.UTC(year, month - 1, day);

  return deadlineUtc < todayUtc;
}

function roundAda(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function getFundingBreakdown(rewardAmount: number) {
  const reward = roundAda(rewardAmount);
  const platformFee = roundAda(reward * PLATFORM_FEE_RATE);
  const totalFunding = roundAda(reward + platformFee);

  return {
    reward,
    platformFee,
    totalFunding,
  };
}

export function validateCreateBountyPayload(body: unknown): ValidationResult<CreateBountyInput> {
  if (!isPlainObject(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const customType = typeof body.custom_type === "string" && body.custom_type.trim() ? body.custom_type.trim() : null;
  const rewardAmount = Number(body.reward_amount);
  const requestedPlatformFee =
    body.platform_fee_amount === undefined ? null : Number(body.platform_fee_amount);
  const requestedTotalFunding =
    body.total_funding_amount === undefined ? null : Number(body.total_funding_amount);
  const deadline = typeof body.deadline === "string" && body.deadline.trim() ? body.deadline.trim() : null;
  const projectId = typeof body.project_id === "string" && body.project_id.trim() ? body.project_id.trim() : null;
  const projectName = typeof body.project_name === "string" && body.project_name.trim() ? body.project_name.trim() : null;
  const projectLogoUrl =
    typeof body.project_logo_url === "string" && body.project_logo_url.trim() ? body.project_logo_url.trim() : null;
  const bountyInstructions =
    typeof body.bounty_instructions === "string" ? body.bounty_instructions.trim() : "";

  if (!title) return { ok: false, field: "title", error: "title is required" };
  if (title.length < MIN_TITLE_LENGTH) {
    return { ok: false, field: "title", error: `title must be at least ${MIN_TITLE_LENGTH} characters` };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, field: "title", error: `title must be at most ${MAX_TITLE_LENGTH} characters` };
  }

  if (!type) return { ok: false, field: "type", error: "type is required" };
  if (!BOUNTY_TYPES.includes(type as BountyType)) {
    return { ok: false, field: "type", error: "type is not supported" };
  }
  if (type.length < MIN_TYPE_LENGTH) {
    return { ok: false, field: "type", error: `type must be at least ${MIN_TYPE_LENGTH} characters` };
  }
  if (type.length > MAX_TYPE_LENGTH) {
    return { ok: false, field: "type", error: `type must be at most ${MAX_TYPE_LENGTH} characters` };
  }
  if (type === "other" && !customType) {
    return { ok: false, field: "custom_type", error: "custom_type is required when type is other" };
  }
  if (customType && customType.length > MAX_TYPE_LENGTH) {
    return { ok: false, field: "custom_type", error: `custom_type must be at most ${MAX_TYPE_LENGTH} characters` };
  }

  if (!description) return { ok: false, field: "description", error: "description is required" };
  if (description.length < MIN_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      field: "description",
      error: `description must be at least ${MIN_DESCRIPTION_LENGTH} characters`,
    };
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      field: "description",
      error: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
    };
  }

  if (!bountyInstructions) return { ok: false, field: "bounty_instructions", error: "bounty_instructions is required" };
  if (bountyInstructions.length < MIN_INSTRUCTIONS_LENGTH) {
    return {
      ok: false,
      field: "bounty_instructions",
      error: `bounty_instructions must be at least ${MIN_INSTRUCTIONS_LENGTH} characters`,
    };
  }
  if (bountyInstructions.length > MAX_INSTRUCTIONS_LENGTH) {
    return {
      ok: false,
      field: "bounty_instructions",
      error: `bounty_instructions must be at most ${MAX_INSTRUCTIONS_LENGTH} characters`,
    };
  }

  if (projectName && projectName.length > MAX_PROJECT_NAME_LENGTH) {
    return {
      ok: false,
      field: "project_name",
      error: `project_name must be at most ${MAX_PROJECT_NAME_LENGTH} characters`,
    };
  }

  if (projectLogoUrl) {
    try {
      const parsedUrl = new URL(projectLogoUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return { ok: false, field: "project_logo_url", error: "project_logo_url must be an HTTP URL" };
      }
    } catch {
      return { ok: false, field: "project_logo_url", error: "project_logo_url must be a valid URL" };
    }
  }

  if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
    return { ok: false, field: "reward_amount", error: "reward_amount must be greater than 0" };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(String(body.reward_amount))) {
    return { ok: false, field: "reward_amount", error: "reward_amount supports up to two decimal places" };
  }
  if (rewardAmount > MAX_REWARD_ADA) {
    return { ok: false, field: "reward_amount", error: `reward_amount cannot exceed ${MAX_REWARD_ADA} ADA` };
  }

  if (deadline && (!isValidDateOnly(deadline) || isPastDateOnly(deadline))) {
    return { ok: false, field: "deadline", error: "deadline must be a valid date that is not in the past" };
  }

  const { reward, platformFee, totalFunding } = getFundingBreakdown(rewardAmount);

  if (requestedPlatformFee !== null && roundAda(requestedPlatformFee) !== platformFee) {
    return { ok: false, field: "platform_fee_amount", error: "platform_fee_amount does not match reward_amount" };
  }

  if (requestedTotalFunding !== null && roundAda(requestedTotalFunding) !== totalFunding) {
    return { ok: false, field: "total_funding_amount", error: "total_funding_amount does not match reward_amount" };
  }

  const payoutType = typeof body.payout_type === "string" && (Object.values(PAYOUT_TYPE) as string[]).includes(body.payout_type)
    ? (body.payout_type as PayoutType)
    : PAYOUT_TYPE.Single;

  const rawMaxWinners = Number(body.max_winners);
  const maxWinners = Number.isInteger(rawMaxWinners) && rawMaxWinners >= 1 ? rawMaxWinners : 1;

  // Validate payout_type constraints
  if (payoutType === PAYOUT_TYPE.Single && maxWinners !== 1) {
    return { ok: false, field: "max_winners", error: "Single payout type must have max_winners of 1" };
  }
  if ((payoutType === PAYOUT_TYPE.EqualSplit || payoutType === PAYOUT_TYPE.ManualSplit) && maxWinners < 2) {
    return { ok: false, field: "max_winners", error: "Multi-winner payout types require max_winners of at least 2" };
  }
  if (maxWinners > MAX_WINNERS) {
    return { ok: false, field: "max_winners", error: `max_winners cannot exceed ${MAX_WINNERS}` };
  }

  // Validate prize_structure for manual_split
  let prizeStructure: Array<{ rank: number; amount_lovelace: number }> | null = null;
  if (payoutType === PAYOUT_TYPE.ManualSplit) {
    if (!Array.isArray(body.prize_structure) || body.prize_structure.length !== maxWinners) {
      return { ok: false, field: "prize_structure", error: `prize_structure must have exactly ${maxWinners} entries for manual_split` };
    }
    const rewardLovelace = Math.round(rewardAmount * LOVELACE_PER_ADA);
    let structureSum = 0;
    const ranks = new Set<number>();
    for (const entry of body.prize_structure) {
      if (typeof entry.rank !== "number" || !Number.isInteger(entry.rank) || entry.rank < 1) {
        return { ok: false, field: "prize_structure", error: "Each prize_structure entry must have a valid integer rank >= 1" };
      }
      if (typeof entry.amount_lovelace !== "number" || entry.amount_lovelace <= 0) {
        return { ok: false, field: "prize_structure", error: "Each prize_structure entry must have amount_lovelace > 0" };
      }
      if (ranks.has(entry.rank)) {
        return { ok: false, field: "prize_structure", error: `Duplicate rank ${entry.rank} in prize_structure` };
      }
      ranks.add(entry.rank);
      structureSum += entry.amount_lovelace;
    }
    if (structureSum !== rewardLovelace) {
      return { ok: false, field: "prize_structure", error: `prize_structure sum (${structureSum} lovelace) must equal reward_amount (${rewardLovelace} lovelace)` };
    }
    prizeStructure = (body.prize_structure as Array<{ rank: number; amount_lovelace: number }>)
      .map(e => ({ rank: e.rank, amount_lovelace: e.amount_lovelace }))
      .sort((a, b) => a.rank - b.rank);
  }

  return {
    ok: true,
    value: {
      title,
      description,
      type,
      custom_type: customType,
      reward_amount: reward,
      platform_fee_amount: platformFee,
      total_funding_amount: totalFunding,
      deadline,
      project_id: projectId,
      project_name: projectName,
      project_logo_url: projectLogoUrl,
      bounty_instructions: bountyInstructions,
      payout_type: payoutType,
      max_winners: payoutType === PAYOUT_TYPE.Single ? 1 : maxWinners,
      prize_structure: prizeStructure,
    },
  };
}

export function validateEscrowPayload(
  body: unknown,
  expectedEscrowAddress: string | undefined,
): ValidationResult<{ escrow_tx_hash: string; escrow_address: string }> {
  if (!isPlainObject(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const escrowTxHash =
    typeof body.escrow_tx_hash === "string"
      ? body.escrow_tx_hash.trim()
      : typeof body.transaction_hash === "string"
        ? body.transaction_hash.trim()
        : "";
  const escrowAddress = typeof body.escrow_address === "string" ? body.escrow_address.trim() : "";

  if (!escrowTxHash) {
    return { ok: false, field: "escrow_tx_hash", error: "escrow_tx_hash is required" };
  }
  if (!TX_HASH_PATTERN.test(escrowTxHash)) {
    return { ok: false, field: "escrow_tx_hash", error: "escrow_tx_hash must be a 64 character hex transaction id" };
  }

  if (!escrowAddress) {
    return { ok: false, field: "escrow_address", error: "escrow_address is required" };
  }
  if (expectedEscrowAddress && escrowAddress !== expectedEscrowAddress) {
    return { ok: false, field: "escrow_address", error: "escrow_address does not match the configured escrow address" };
  }

  return { ok: true, value: { escrow_tx_hash: escrowTxHash, escrow_address: escrowAddress } };
}
