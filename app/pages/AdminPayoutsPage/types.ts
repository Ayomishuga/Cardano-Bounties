import { LOVELACE_PER_ADA } from "@/lib/bountyContract";
import { shortId } from "@/lib/formatters";

export type AllocationStatus = "pending" | "processing" | "paid" | "failed" | "cancelled";

export type Allocation = {
  id: string;
  bounty_id: string;
  submission_id: string;
  contributor_id: string;
  amount_lovelace: number | string;
  rank: number | null;
  status: AllocationStatus;
  transaction_hash: string | null;
  paid_at: string | null;
  created_at: string;
  users?: { id: string; stake_address?: string | null; display_name?: string | null } | null;
  submissions?: { id: string; content?: string | null; submitted_at?: string | null } | null;
};

export type Prize = {
  rank: number;
  amount_lovelace: number;
};

export type BountySubmission = {
  id: string;
  status: string;
  contributor_id?: string | null;
  content?: string | null;
  submitted_at?: string | null;
};

export type Bounty = {
  id: string;
  title: string;
  status: string;
  reward_amount?: number | string | null;
  payout_type?: string | null;
  max_winners?: number | null;
  winners_finalized?: boolean;
  prize_structure?: Prize[] | null;
  escrow_tx_hash?: string | null;
  allocations?: Allocation[];
  submissions?: BountySubmission[];
};

export type DashboardResponse = {
  queues: {
    bounties?: Bounty[];
    in_review_bounties?: Bounty[];
  };
  error?: string;
};

export type AllocationDraft = {
  amountAda?: string;
  rank?: string;
};

// ── Helpers ───────────────────────────────────────────────────

export function lovelaceToAda(lovelace: number | string | null | undefined): number {
  const lv = Number(lovelace || 0);
  return lv / LOVELACE_PER_ADA;
}

export function formatAda(lovelace: number | string | null | undefined): string {
  const ada = lovelaceToAda(lovelace);
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(ada)} ADA`;
}

export function formatAdaValue(lovelace: number | string | null | undefined): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(lovelaceToAda(lovelace));
}

export function rewardToLovelace(rewardAda: number | string | null | undefined): number {
  return Math.round(Number(rewardAda || 0) * LOVELACE_PER_ADA);
}

export function getHandle(alloc: Allocation): string {
  return alloc.users?.display_name || shortId(alloc.users?.stake_address || alloc.contributor_id);
}

export function getSubmissionHandle(submission: BountySubmission): string {
  return shortId(submission.contributor_id);
}

export const RANK_LABEL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function rankLabel(rank: number | null): string {
  if (!rank) return "";
  return `${RANK_LABEL[rank] ?? `#${rank}`} `;
}
