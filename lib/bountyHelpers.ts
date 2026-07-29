/**
 * Domain-specific helpers for bounty and submission data.
 *
 * These functions know the shape of our Bounty/Submission types but contain
 * no UI or React code. They answer questions like "what is the display name
 * for this payout type?" or "which bounty does this submission belong to?"
 *
 * Import from here instead of defining these in each page component.
 */

import type { Bounty, Submission, UserProfile, PayoutType } from "@/types/bounty";
import { shortId, normalizeStatus } from "./formatters";

// ---------------------------------------------------------------------------
// Submission helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the bounty record from a submission regardless of whether the API
 * returned it as `submission.bounty` (singular join) or `submission.bounties`
 * (array or object join).
 */
export function getSubmissionBounty(submission: Submission): Bounty | null {
  if (submission.bounty) return submission.bounty;
  if (Array.isArray(submission.bounties)) return submission.bounties[0] ?? null;
  return submission.bounties ?? null;
}

/**
 * Returns the most readable handle for a submission's contributor.
 * Prefers display_name, then stake_address, then contributor_id.
 */
export function getSubmitterHandle(submission: Submission): string {
  return (
    submission.contributor?.display_name ||
    shortId(submission.contributor?.stake_address || submission.contributor_id)
  );
}

/**
 * Groups an array of submissions by their parent bounty, preserving
 * one group per unique bounty ID. Useful for the admin submission review view.
 */
export function groupSubmissionsByBounty(
  submissions: Submission[],
): Array<{ bounty: Bounty | null; submissions: Submission[] }> {
  const groups = new Map<string, { bounty: Bounty | null; submissions: Submission[] }>();

  for (const submission of submissions) {
    const bounty = getSubmissionBounty(submission);
    const key = bounty?.id || submission.bounty_id || "unknown";
    const existing = groups.get(key);

    if (existing) {
      existing.submissions.push(submission);
    } else {
      groups.set(key, { bounty, submissions: [submission] });
    }
  }

  return [...groups.values()];
}

// ---------------------------------------------------------------------------
// Bounty display helpers
// ---------------------------------------------------------------------------

/**
 * Returns the project name for a bounty, falling back to "Independent bounty"
 * when no project is associated.
 */
export function getProjectName(bounty: Bounty): string {
  return bounty.project_name || bounty.projects?.name || "Independent bounty";
}

/**
 * Returns the project logo URL for a bounty, or an empty string when none exists.
 */
export function getProjectLogoUrl(bounty: Bounty): string {
  return bounty.project_logo_url || bounty.projects?.logo_url || "";
}

/**
 * Returns the poster's display handle: prefers display_name, then a
 * truncated stake_address, then the raw created_by field.
 */
export function getPosterLabel(bounty: Bounty): string {
  return (
    bounty.poster?.display_name ||
    shortId(bounty.poster?.stake_address || bounty.created_by)
  );
}

/**
 * Returns a short human-readable note describing where a bounty is
 * in its lifecycle. Used in admin queues to surface actionable context.
 */
export function getBountyLifecycleNote(bounty: Bounty): string {
  if (bounty.status === "rejected") {
    return bounty.refund_tx_hash
      ? `Rejected: refund recorded ${shortId(bounty.refund_tx_hash)}`
      : "Rejected: hidden from public board; refund transaction is required.";
  }

  if (bounty.status === "cancelled" || bounty.status === "expired") {
    return bounty.refund_tx_hash
      ? `Refund recorded ${shortId(bounty.refund_tx_hash)}`
      : `${normalizeStatus(bounty.status)}: refund transaction is required if escrow was funded.`;
  }

  if (bounty.status === "awaiting_admin_review") {
    return "Escrow verified; admin must approve to publish or reject for refund.";
  }

  if (bounty.status === "pending_escrow") {
    const verificationPending =
      Boolean(bounty.escrow_tx_hash) && !bounty.escrow_confirmed_at;

    if (verificationPending) {
      return bounty.escrow_last_checked_at
        ? `Escrow submitted; last verification check ${bounty.escrow_last_checked_at}.`
        : "Escrow submitted; waiting for on-chain verification.";
    }

    return "Waiting for escrow transaction verification before admin review.";
  }

  if (bounty.status === "open") return "Public bounty accepting submissions.";
  if (bounty.status === "completed") return "Completed bounty; payout has been recorded.";
  return normalizeStatus(bounty.status);
}

/**
 * Returns the escrow funding state label shown in admin queues.
 */
export function getFundingState(bounty: Bounty): string {
  if (bounty.escrow_confirmed_at) return "Escrow confirmed";
  if (bounty.escrow_tx_hash) return "Verification pending";
  return "Awaiting escrow";
}

/**
 * Returns true if the bounty is pending escrow verification.
 */
export function isEscrowVerificationPending(bounty: Bounty): boolean {
  return bounty.status === "pending_escrow" && Boolean(bounty.escrow_tx_hash) && !bounty.escrow_confirmed_at;
}

// ---------------------------------------------------------------------------
// Payout type helpers
// ---------------------------------------------------------------------------

/**
 * Returns a user-facing label for a payout type value.
 *
 * @example getPayoutTypeLabel("equal_split") → "Equal split"
 * @example getPayoutTypeLabel("manual_split") → "Manual split"
 * @example getPayoutTypeLabel(null) → "Single winner"
 */
export function getPayoutTypeLabel(value: PayoutType | string | null | undefined): string {
  if (value === "equal_split") return "Equal split";
  if (value === "manual_split") return "Manual split";
  return "Single winner";
}

/**
 * Returns a sentence describing how the payout pool will be distributed,
 * suitable for display in submission review panels.
 */
export function getPayoutSummary(bounty: Bounty | null): string {
  if (!bounty) return "Bounty details unavailable";
  const maxWinners = Number(bounty.max_winners || 1);
  const plural = maxWinners === 1 ? "" : "s";

  if (bounty.payout_type === "equal_split") {
    return `Pool shared equally across up to ${maxWinners} winner${plural}.`;
  }

  if (bounty.payout_type === "manual_split") {
    return `Admin allocates the pool manually across up to ${maxWinners} winner${plural}.`;
  }

  return "Full reward goes to one approved winner.";
}

export function getBountyCategoryLabel(bounty: Bounty | null): string {
  if (!bounty) return "Unknown";
  return normalizeStatus(bounty.custom_type || bounty.type || "Unknown");
}

// ---------------------------------------------------------------------------
// Status predicates
// ---------------------------------------------------------------------------

/**
 * Returns true when a bounty is accepting new contributor submissions.
 */
export function isAcceptingContributions(status: string | null | undefined): boolean {
  return status === "open";
}

/**
 * Returns true when the admin can review and approve/reject this bounty.
 */
export function canAdminReviewBounty(bounty: Bounty): boolean {
  return bounty.status === "awaiting_admin_review";
}

// ---------------------------------------------------------------------------
// UserProfile helpers
// ---------------------------------------------------------------------------

/**
 * Returns the most readable display handle for a user profile.
 */
export function getUserHandle(profile: UserProfile | null | undefined): string {
  if (!profile) return "Unknown user";
  return profile.display_name || shortId(profile.stake_address) || profile.id;
}

// ---------------------------------------------------------------------------
// Bounty view helpers
// ---------------------------------------------------------------------------

const categoryLabels: Record<string, string> = {
  code: "Code",
  development: "Code",
  dev: "Code",
  design: "Design",
  content: "Content",
  documentation: "Docs",
  docs: "Docs",
  research: "Research",
  community: "Community",
  security: "Security",
};

export function normalizeBountyType(type: string | null | undefined): string {
  if (!type) return "Other";
  const key = type.trim().toLowerCase();
  return categoryLabels[key] ?? type.trim();
}

export function getDeadlineState(value: string | null | undefined): string {
  if (!value) return "Open";
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return "Open";

  const diff = deadline.getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return "Past deadline";
  if (days === 0) return "Due today";
  if (days <= 7) return `${days}d left`;
  return "Open";
}

export function getBountyState(bounty: Bounty): string {
  if (bounty.status === "in_review") return "In review";
  return getDeadlineState(bounty.deadline);
}

export function isBountyInReview(bounty: Bounty): boolean {
  return bounty.status === "in_review";
}

/**
 * Returns true when the bounty deadline is within 7 days (but not yet passed).
 * Used by the poster overview warning banner.
 */
export function isExpiringSoon(deadline: string | null | undefined): boolean {
  if (!deadline) return false;
  const diff = new Date(deadline).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days >= 0 && days <= 7;
}

/**
 * Returns true when the poster is allowed to extend the bounty deadline.
 * Bounty must be open and have used fewer than MAX_DEADLINE_EXTENSIONS extensions.
 */
export function canExtendDeadline(bounty: Bounty): boolean {
  return bounty.status === "open" && (bounty.deadline_extended_count ?? 0) < 2;
}
