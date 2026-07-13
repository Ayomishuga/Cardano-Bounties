import { NextRequest, NextResponse } from "next/server";
import { BOUNTY_STATUS, SUBMISSION_STATUS, LOVELACE_PER_ADA } from "@/lib/bountyContract";
import { supabaseAdmin } from "@/lib/supabase";

async function attachPosterProfiles<T extends { created_by?: string | null }>(bounties: T[]) {
  const posterIds = [...new Set(bounties.map((bounty) => bounty.created_by).filter(Boolean))] as string[];

  if (posterIds.length === 0) return bounties;

  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, stake_address, display_name, role, created_at")
    .in("id", posterIds);

  const usersById = new Map((users || []).map((user) => [user.id, user]));

  return bounties.map((bounty) => ({
    ...bounty,
    poster: bounty.created_by ? usersById.get(bounty.created_by) || null : null,
  }));
}

async function attachContributorProfiles<T extends { contributor_id?: string | null }>(submissions: T[]) {
  const contributorIds = [...new Set(submissions.map((submission) => submission.contributor_id).filter(Boolean))] as string[];

  if (contributorIds.length === 0) return submissions;

  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, stake_address, display_name, role, created_at")
    .in("id", contributorIds);

  const usersById = new Map((users || []).map((user) => [user.id, user]));

  return submissions.map((submission) => ({
    ...submission,
    contributor: submission.contributor_id ? usersById.get(submission.contributor_id) || null : null,
  }));
}


export async function GET(req: NextRequest): Promise<NextResponse> {
  const role = req.headers.get("x-user-role");

  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [bountiesResult, submissionsResult, allocationsResult] = await Promise.all([
    supabaseAdmin
      .from("bounties")
      .select(
        `
          *,
          submissions (
            id,
            status,
            contributor_id,
            content,
            feedback,
            poster_review_status,
            poster_feedback,
            poster_reviewed_at,
            created_at:submitted_at,
            submitted_at,
            reviewed_at,
            paid_at,
            transaction_hash
          )
        `,
      )
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("submissions")
      .select(
        `
          id,
          bounty_id,
          contributor_id,
          content,
          status,
          feedback,
          poster_review_status,
          poster_feedback,
          poster_reviewed_at,
          created_at:submitted_at,
          submitted_at,
          reviewed_at,
          paid_at,
          transaction_hash,
          updated_at,
          bounties (
            id,
            title,
            description,
            bounty_instructions,
            type,
            custom_type,
            deadline,
            reward_amount,
            total_funding_amount,
            payout_type,
            max_winners,
            prize_structure,
            status,
            created_by
          )
        `,
      )
      .order("submitted_at", { ascending: false }),
    supabaseAdmin
      .from("bounty_payout_allocations")
      .select("id, bounty_id, amount_lovelace, status"),
  ]);

  if (bountiesResult.error) {
    console.error("Admin dashboard bounty query failed:", bountiesResult.error);
    return NextResponse.json({ error: bountiesResult.error.message }, { status: 500 });
  }

  if (submissionsResult.error) {
    console.error("Admin dashboard submission query failed:", submissionsResult.error);
    return NextResponse.json({ error: submissionsResult.error.message }, { status: 500 });
  }

  if (allocationsResult.error) {
    console.error("Admin dashboard allocation query failed:", allocationsResult.error);
    return NextResponse.json({ error: allocationsResult.error.message }, { status: 500 });
  }

  const bounties = await attachPosterProfiles(bountiesResult.data || []);
  const submissions = await attachContributorProfiles(submissionsResult.data || []);
  const allocations = allocationsResult.data || [];

  const awaitingBounties      = bounties.filter((b) => b.status === BOUNTY_STATUS.AwaitingAdminReview);
  const pendingEscrowBounties  = bounties.filter((b) => b.status === BOUNTY_STATUS.PendingEscrow);
  const inReviewBounties       = bounties.filter((b) => b.status === BOUNTY_STATUS.InReview);
  const partiallyPaidBounties  = bounties.filter((b) => b.status === BOUNTY_STATUS.PartiallyPaid);
  const nonLiveBounties        = bounties.filter((b) =>
    ![BOUNTY_STATUS.Open, BOUNTY_STATUS.Completed, BOUNTY_STATUS.InReview,
      BOUNTY_STATUS.PayoutPending, BOUNTY_STATUS.PartiallyPaid].includes(b.status),
  );
  const openBounties           = bounties.filter((b) => b.status === BOUNTY_STATUS.Open);
  // Build per-bounty submission counts for the review modal context panel
  const subCountMap = new Map<string, number>();
  const approvedCountMap = new Map<string, number>();
  for (const s of submissions) {
    if (!s.bounty_id) continue;
    subCountMap.set(s.bounty_id, (subCountMap.get(s.bounty_id) ?? 0) + 1);
    if (s.status === SUBMISSION_STATUS.Approved)
      approvedCountMap.set(s.bounty_id, (approvedCountMap.get(s.bounty_id) ?? 0) + 1);
  }
  const pendingSubmissions = submissions
    .filter((s) => s.status === SUBMISSION_STATUS.Pending)
    .map((s) => ({
      ...s,
      bounties: s.bounties
        ? { ...s.bounties, submission_count: subCountMap.get(s.bounty_id ?? "") ?? 1, approved_count: approvedCountMap.get(s.bounty_id ?? "") ?? 0 }
        : s.bounties,
    }));
  const refundCandidates       = bounties.filter((b) =>
    [BOUNTY_STATUS.Rejected, BOUNTY_STATUS.Cancelled, BOUNTY_STATUS.Expired].includes(b.status),
  );

  // Allocation-based payout metrics
  const pendingAllocations     = allocations.filter((a) => a.status === "pending");
  const openBountiesWithApprovedSubmissions = openBounties.filter((bounty) =>
    ((bounty as { submissions?: Array<{ status?: string | null }> }).submissions || [])
      .some((submission) => submission.status === SUBMISSION_STATUS.Approved),
  );
  const awaitingAllocation     = inReviewBounties.filter((b) => !(b as { winners_finalized?: boolean }).winners_finalized);
  const payoutQueueBounties    = bounties.filter((bounty) => {
    const status = bounty.status;
    const hasApprovedSubmission = ((bounty as { submissions?: Array<{ status?: string | null }> }).submissions || [])
      .some((submission) => submission.status === SUBMISSION_STATUS.Approved);

    return (
      [BOUNTY_STATUS.InReview, BOUNTY_STATUS.PayoutPending, BOUNTY_STATUS.PartiallyPaid].includes(status) ||
      (status === BOUNTY_STATUS.Open && hasApprovedSubmission)
    );
  });
  const queuedPayoutLovelace   = pendingAllocations.reduce((sum, a) => sum + Number(a.amount_lovelace), 0);
  const queuedPayoutAda        = queuedPayoutLovelace / LOVELACE_PER_ADA;

  return NextResponse.json({
    role: "admin",
    metrics: {
      open_bounties:            openBounties.length,
      not_live_bounties:        nonLiveBounties.length,
      awaiting_bounty_reviews:  awaitingBounties.length,
      pending_escrow_bounties:  pendingEscrowBounties.length,
      refund_candidates:        refundCandidates.length,
      pending_submissions:      pendingSubmissions.length,
      // Allocation-based payout metrics. approved_payouts is kept as a UI compatibility alias.
      approved_payouts:         payoutQueueBounties.length,
      payout_queue_items:       payoutQueueBounties.length,
      open_approved_payouts:    openBountiesWithApprovedSubmissions.length,
      awaiting_allocation:      awaitingAllocation.length,
      pending_payouts:          pendingAllocations.length,
      queued_payout_ada:        queuedPayoutAda,
      partially_paid_bounties:  partiallyPaidBounties.length,
    },
    queues: {
      bounties,
      bounty_reviews:       awaitingBounties,
      non_live_bounties:    nonLiveBounties,
      pending_submissions:  pendingSubmissions,
      in_review_bounties:   inReviewBounties,
      refund_candidates:    refundCandidates,
    },
    recent_activity: [...bounties].slice(0, 8),
  });
}
