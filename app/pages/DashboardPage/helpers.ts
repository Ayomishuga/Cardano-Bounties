import type { Bounty, Submission } from "@/types/bounty";
import { formatRelativeTime, normalizeStatus, shortId } from "@/lib/formatters";

export function getSubmissionBounty(submission: Submission): Bounty | null {
  if (submission.bounty) return submission.bounty;
  if (Array.isArray(submission.bounties)) return submission.bounties[0] || null;
  return submission.bounties || null;
}

export function isOlderThanHours(value: string | null | undefined, hours: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() > hours * 60 * 60 * 1000;
}

export function groupSubmissionsByBounty(submissions: Submission[]) {
  const groups = new Map<string, { bounty: Bounty | null; submissions: Submission[] }>();

  submissions.forEach((submission) => {
    const bounty = getSubmissionBounty(submission);
    const key = bounty?.id || submission.bounty_id || "unknown";
    const existing = groups.get(key);

    if (existing) {
      existing.submissions.push(submission);
    } else {
      groups.set(key, { bounty, submissions: [submission] });
    }
  });

  return [...groups.values()];
}

export function canAdminReviewBounty(bounty: Bounty) {
  return bounty.status === "awaiting_admin_review";
}

export function isEscrowVerificationPending(bounty: Bounty) {
  return bounty.status === "pending_escrow" && Boolean(bounty.escrow_tx_hash) && !bounty.escrow_confirmed_at;
}

export function getFundingState(bounty: Bounty) {
  if (bounty.escrow_confirmed_at) return "Escrow confirmed";
  if (bounty.escrow_tx_hash) return "Verification pending";
  return "Awaiting escrow";
}

export function getPosterLabel(bounty: Bounty) {
  return bounty.poster?.display_name || shortId(bounty.poster?.stake_address || bounty.created_by);
}

export function getBountyLifecycleNote(bounty: Bounty) {
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
    if (isEscrowVerificationPending(bounty)) {
      return bounty.escrow_last_checked_at
        ? `Escrow submitted; last verification check ${formatRelativeTime(bounty.escrow_last_checked_at)}.`
        : "Escrow submitted; waiting for on-chain verification.";
    }

    return "Waiting for escrow transaction verification before admin review.";
  }

  if (bounty.status === "open") return "Public bounty accepting submissions.";
  if (bounty.status === "completed") return "Completed bounty; payout has been recorded.";
  return normalizeStatus(bounty.status);
}

export function getBountySubmissions(bounty: Bounty | null | undefined): Submission[] {
  return (bounty?.submissions as Submission[]) || [];
}

export function getSubmissionProgress(bounty: Bounty | null | undefined) {
  const submissions = getBountySubmissions(bounty);
  const accepted = submissions.filter((submission) =>
    ["approved", "paid"].includes(submission.status),
  ).length;
  const total = Math.max(submissions.length, 1);
  return Math.min(100, Math.round((accepted / total) * 100));
}
