import { BOUNTY_STATUS } from "@/lib/bountyContract";

export type BountyLifecycleInput = {
  status?: string | null;
  deadline?: string | null;
};

export type EffectiveBountyStatus =
  | "pending_escrow"
  | "awaiting_admin_review"
  | "open"
  | "closed_for_submissions"
  | "in_review"
  | "payout_pending"
  | "partially_paid"
  | "completed"
  | "cancelled"
  | "rejected"
  | "expired"
  | string;

export type BountyLifecycleFields = {
  accepts_contributions: boolean;
  deadline_state: string;
  effective_status: EffectiveBountyStatus;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getTodayUtcDateOnly(now = new Date()) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function getTodayUtcDateString(now = new Date()) {
  return new Date(getTodayUtcDateOnly(now)).toISOString().slice(0, 10);
}

export function parseDateOnlyUtc(value: string | null | undefined): number | null {
  if (!value) return null;

  const [datePart] = value.split("T");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;

  const [year, month, day] = datePart.split("-").map(Number);
  const dateUtc = Date.UTC(year, month - 1, day);
  const parsed = new Date(dateUtc);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return dateUtc;
}

export function isPastDeadline(deadline: string | null | undefined, now = new Date()) {
  const deadlineUtc = parseDateOnlyUtc(deadline);
  if (deadlineUtc === null) return false;
  return deadlineUtc < getTodayUtcDateOnly(now);
}

export function getDeadlineState(deadline: string | null | undefined, now = new Date()) {
  const deadlineUtc = parseDateOnlyUtc(deadline);
  if (deadlineUtc === null) return "Open";

  const days = Math.ceil((deadlineUtc - getTodayUtcDateOnly(now)) / MS_PER_DAY);
  if (days < 0) return "Past deadline";
  if (days === 0) return "Due today";
  if (days <= 7) return `${days}d left`;
  return "Open";
}

export function isAcceptingContributions(bounty: BountyLifecycleInput, now = new Date()) {
  return bounty.status === BOUNTY_STATUS.Open && !isPastDeadline(bounty.deadline, now);
}

export function getEffectiveBountyStatus(
  bounty: BountyLifecycleInput,
  now = new Date(),
): EffectiveBountyStatus {
  if (bounty.status === BOUNTY_STATUS.Open && isPastDeadline(bounty.deadline, now)) {
    return "closed_for_submissions";
  }

  return bounty.status || "unknown";
}

export function getBountyLifecycleFields(
  bounty: BountyLifecycleInput,
  now = new Date(),
): BountyLifecycleFields {
  return {
    accepts_contributions: isAcceptingContributions(bounty, now),
    deadline_state: getDeadlineState(bounty.deadline, now),
    effective_status: getEffectiveBountyStatus(bounty, now),
  };
}

export function determinePastDeadlineDisposition(
  submissions: Array<{ status: string }> = []
): "in_review" | "expired" {
  const hasActiveSubmissions = submissions.some(
    (s) => s.status === "approved" || s.status === "pending"
  );
  return hasActiveSubmissions ? "in_review" : "expired";
}

