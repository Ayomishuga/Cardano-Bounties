import type { PayoutAllocation, Bounty, Submission, UserProfile } from "@/types/bounty";

export type PayoutStage =
  | "needs_allocation"
  | "ready_to_finalize"
  | "ready_to_pay"
  | "awaiting_confirmation"
  | "needs_attention"
  | "completed";

export type AdminPayoutAllocation = PayoutAllocation & {
  amount_lovelace: number | string;
  payout_address?: string | null;
  payout_address_source?: string | null;
  payout_submitted_at?: string | null;
  payout_confirmed_at?: string | null;
  payout_error?: string | null;
  users?: UserProfile | null;
  submissions?: Pick<Submission, "id" | "content" | "submitted_at"> | null;
};

export type AdminPayoutBounty = Bounty & {
  reward_amount?: number | string | null;
  allocations?: AdminPayoutAllocation[];
  submissions?: Submission[];
};
