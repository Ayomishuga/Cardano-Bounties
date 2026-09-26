import type { Submission } from "@/types/bounty";

export type DashboardResponse = {
  queues: {
    pending_submissions?: Submission[];
  };
  error?: string;
};

export type SubmissionSortColumn = "submitter" | "amount" | "status" | "submitted";

export {
  getSubmitterHandle,
  getPayoutSummary,
  getBountyCategoryLabel,
} from "@/lib/bountyHelpers";
