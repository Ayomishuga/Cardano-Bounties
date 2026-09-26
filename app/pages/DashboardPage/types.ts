import type { Bounty, Submission } from "@/types/bounty";

export type DashboardResponse = {
  role: "admin" | "poster";
  metrics: Record<string, number>;
  queues: {
    bounty_reviews?: Bounty[];
    pending_submissions?: Submission[];
    approved_payouts?: Submission[];
    refund_candidates?: Bounty[];
    non_live_bounties?: Bounty[];
    bounties?: Bounty[];
    pending_submission_reviews?: Submission[];
    submissions?: Submission[];
  };
  recent_activity?: Bounty[];
  error?: string;
};

export type AdminTab = "approval" | "submissions" | "bounties";

export const adminTabs: Array<{ id: AdminTab; label: string }> = [
  { id: "approval", label: "Approval queue" },
  { id: "submissions", label: "Submission review" },
  { id: "bounties", label: "All bounties" },
];
