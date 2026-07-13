import { NextRequest, NextResponse } from "next/server";
import { LOVELACE_PER_ADA, SUBMISSION_STATUS } from "@/lib/bountyContract";
import { supabaseAdmin } from "@/lib/supabase";

type Allocation = {
  id: string;
  submission_id: string;
  amount_lovelace: number | string;
  rank?: number | null;
  status: string;
  transaction_hash?: string | null;
  paid_at?: string | null;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [submissionsResult, allocationsResult] = await Promise.all([
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
          created_at:submitted_at,
          submitted_at,
          reviewed_at,
          paid_at,
          transaction_hash,
          bounties (
            id,
            title,
            description,
            bounty_instructions,
            reward_amount,
            type,
            custom_type,
            status,
            deadline,
            project_name,
            project_logo_url,
            payout_type,
            max_winners,
            prize_structure
          )
        `,
      )
      .eq("contributor_id", userId)
      .order("submitted_at", { ascending: false }),
    supabaseAdmin
      .from("bounty_payout_allocations")
      .select("id, bounty_id, submission_id, contributor_id, amount_lovelace, rank, status, transaction_hash, paid_at, created_at")
      .eq("contributor_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (submissionsResult.error) {
    console.error("Contributor dashboard submission query failed:", submissionsResult.error);
    return NextResponse.json({ error: submissionsResult.error.message }, { status: 500 });
  }

  if (allocationsResult.error) {
    console.error("Contributor dashboard allocation query failed:", allocationsResult.error);
    return NextResponse.json({ error: allocationsResult.error.message }, { status: 500 });
  }

  const allocations = (allocationsResult.data || []) as Allocation[];
  const allocationsBySubmission = new Map<string, Allocation[]>();

  for (const allocation of allocations) {
    const list = allocationsBySubmission.get(allocation.submission_id) || [];
    list.push(allocation);
    allocationsBySubmission.set(allocation.submission_id, list);
  }

  const contributions = (submissionsResult.data || []).map((submission) => ({
    ...submission,
    allocations: allocationsBySubmission.get(submission.id) || [],
  }));

  const pending = contributions.filter((s) => s.status === SUBMISSION_STATUS.Pending);
  const approved = contributions.filter((s) => s.status === SUBMISSION_STATUS.Approved);
  const rejected = contributions.filter((s) => s.status === SUBMISSION_STATUS.Rejected);
  const paid = contributions.filter((s) => s.status === SUBMISSION_STATUS.Paid);
  const notSelected = contributions.filter((s) => s.status === SUBMISSION_STATUS.NotSelected);
  const recommended = contributions.filter((s) => s.poster_review_status === "recommended_approval");

  const totalEarned = allocations
    .filter((allocation) => allocation.status === "paid")
    .reduce((sum, allocation) => sum + Number(allocation.amount_lovelace), 0) / LOVELACE_PER_ADA;

  const pendingAda = allocations
    .filter((allocation) => allocation.status === "pending")
    .reduce((sum, allocation) => sum + Number(allocation.amount_lovelace), 0) / LOVELACE_PER_ADA;

  return NextResponse.json({
    role: "contributor",
    metrics: {
      total_submissions: contributions.length,
      pending_submissions: pending.length,
      recommended_submissions: recommended.length,
      approved_submissions: approved.length,
      rejected_submissions: rejected.length,
      not_selected: notSelected.length,
      paid_submissions: paid.length,
      total_earned_ada: totalEarned,
      pending_ada: pendingAda,
    },
    queues: {
      contributions,
    },
    submissions: contributions,
  });
}
