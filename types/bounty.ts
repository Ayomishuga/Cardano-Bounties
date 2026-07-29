/**
 * Shared domain types for the Cardano Bounties platform.
 *
 * These mirror the Supabase table columns returned by the API. Import from
 * here instead of defining local types in each page. If a column is added to
 * the database, update it once here and all pages inherit the change.
 */

// ---------------------------------------------------------------------------
// Enumerations (string unions matching DB check constraints)
// ---------------------------------------------------------------------------

export type BountyStatus =
  | "pending_escrow"
  | "awaiting_admin_review"
  | "open"
  | "in_review"
  | "payout_pending"
  | "partially_paid"
  | "completed"
  | "cancelled"
  | "rejected"
  | "expired";

export type PayoutType = "single" | "equal_split" | "manual_split";

export type SubmissionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "closed"
  | "not_selected"
  | "paid";

export type AllocationStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled";

// ---------------------------------------------------------------------------
// Core entity shapes
// ---------------------------------------------------------------------------

/** One ranked prize slot inside a manual_split bounty's prize_structure. */
export type PrizeSlot = {
  rank: number;
  amount_lovelace: number;
};

/** A platform user (poster, contributor, or admin). */
export type UserProfile = {
  id: string;
  stake_address?: string | null;
  display_name?: string | null;
  role?: string | null;
};

/** A bounty record as returned by the API (public or admin endpoints). */
export type Bounty = {
  id: string;
  title: string;
  description?: string | null;
  bounty_instructions?: string | null;
  type?: string | null;
  custom_type?: string | null;
  status: BountyStatus | string;
  reward_amount?: number | string | null;
  platform_fee_amount?: number | string | null;
  total_funding_amount?: number | string | null;
  deadline?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  // Escrow tracking
  escrow_address?: string | null;
  escrow_tx_hash?: string | null;
  escrow_submitted_at?: string | null;
  escrow_confirmed_at?: string | null;
  escrow_last_checked_at?: string | null;
  escrow_verification_attempts?: number | null;
  escrow_verification_error?: string | null;
  // Deadline extension tracking
  deadline_extended_count?: number | null;
  // Refund tracking
  refund_tx_hash?: string | null;
  refunded_at?: string | null;
  // Multi-winner payout fields
  payout_type?: PayoutType | null;
  max_winners?: number | null;
  prize_structure?: PrizeSlot[] | null;
  winners_finalized?: boolean | null;
  // Project metadata
  project_name?: string | null;
  project_logo_url?: string | null;
  projects?: { name?: string | null; logo_url?: string | null } | null;
  // Joined relations (present only when API selects them)
  poster?: UserProfile | null;
  submissions?: Submission[];
  submission_count?: number;
  approved_count?: number;
};

/** A contributor's work submission linked to a bounty. */
export type Submission = {
  id: string;
  bounty_id?: string | null;
  contributor_id?: string | null;
  content?: string | null;
  status: SubmissionStatus | string;
  feedback?: string | null;
  // Poster review fields
  poster_review_status?: string | null;
  poster_feedback?: string | null;
  poster_reviewed_at?: string | null;
  // Timestamps
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_at?: string | null;
  paid_at?: string | null;
  transaction_hash?: string | null;
  // Joined relations — shape depends on which endpoint fetched this
  bounties?: Bounty | Bounty[] | null;
  bounty?: Bounty;
  contributor?: UserProfile | null;
  allocations?: PayoutAllocation[];
};

/**
 * A payout allocation slot for one winner of a multi-winner bounty.
 * Returned by GET /api/admin/allocations?bounty_id=...
 */
export type PayoutAllocation = {
  id: string;
  bounty_id: string;
  submission_id: string;
  contributor_id: string;
  amount_lovelace: number;
  rank?: number | null;
  status: AllocationStatus;
  transaction_hash?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  // Joined relation — submission with contributor details
  submissions?: (Submission & { contributor?: UserProfile | null }) | null;
};

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

/** Pagination metadata returned by list endpoints. */
export type BountyPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

/** Shape of GET /api/bounties response. */
export type BountyListResponse = {
  data?: Bounty[];
  pagination?: BountyPagination;
  error?: string;
};

/** Shape of GET /api/dashboard/admin response. */
export type AdminDashboardResponse = {
  role: "admin";
  metrics: Record<string, number>;
  queues: {
    bounty_reviews?: Bounty[];
    pending_submissions?: Submission[];
    approved_payouts?: Submission[];
    refund_candidates?: Bounty[];
    non_live_bounties?: Bounty[];
    bounties?: Bounty[];
  };
  recent_activity?: Bounty[];
  error?: string;
};

/** Shape of GET /api/dashboard/poster response. */
export type PosterDashboardResponse = {
  role: "poster";
  metrics: Record<string, number>;
  queues: {
    bounties?: Bounty[];
    pending_submission_reviews?: Submission[];
    submissions?: Submission[];
  };
  error?: string;
};
