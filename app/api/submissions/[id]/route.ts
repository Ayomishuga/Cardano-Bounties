import { NextRequest, NextResponse } from "next/server";
import { SUBMISSION_STATUS, BOUNTY_STATUS } from "@/lib/bountyContract";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { getPrizeSlotAmount, getRankPlacementLabel } from "@/lib/bountyHelpers";
import type { Bounty } from "@/types/bounty";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("submissions")
    .select(
      `
        *,
        bounties (id, title, reward_amount ),
        users ( id, stake_address, display_name )
        `,
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Submission not found" },
      { status: 404 },
    );
  }

  // Contributors can only view their own submissions
  // Admins can view any submission
  if (userRole !== "admin" && data.Contributor_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(data);
}

// PATCH /api/submissions/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const role = req.headers.get("x-user-role");
  const adminId = req.headers.get("x-user-id");

  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { status, feedback } = body;

  if (
    !status ||
    ![SUBMISSION_STATUS.Approved, SUBMISSION_STATUS.Rejected].includes(status)
  ) {
    return NextResponse.json(
      { error: "status must be approved or rejected" },
      { status: 400 },
    );
  }

  const { data: submission, error: fetchError } = await supabaseAdmin
    .from("submissions")
    .select("*, bounties (*)")
    .eq("id", id)
    .single();

  if (fetchError || !submission) {
    return NextResponse.json(
      { error: "Submission not found" },
      { status: 404 },
    );
  }

  if (submission.status !== SUBMISSION_STATUS.Pending) {
    return NextResponse.json(
      { error: "Only pending submissions can be reviewed" },
      { status: 400 },
    );
  }

  const rawBounty = submission.bounties;
  const bounty = (Array.isArray(rawBounty) ? rawBounty[0] : rawBounty) as Bounty | null;

  // On approval, automatically move bounty to in_review if it was open
  if (status === SUBMISSION_STATUS.Approved && bounty && bounty.status === BOUNTY_STATUS.Open) {
    await supabaseAdmin
      .from("bounties")
      .update({
        status: BOUNTY_STATUS.InReview,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bounty.id);
  }

  // Update submission status and feedback
  const { data, error } = await supabaseAdmin
    .from("submissions")
    .update({
      status,
      feedback: typeof feedback === "string" ? feedback.trim() || null : null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*, bounties(*)")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Submission update failed" },
      { status: error ? 500 : 400 },
    );
  }

  let allocationResult: { ok: boolean; error?: string } | null = null;
  let finalRank: number | null = null;
  let finalAmountLovelace: number | null = null;

  // Atomic position and prize allocation on approval
  if (status === SUBMISSION_STATUS.Approved && bounty && adminId) {
    // Resolve rank
    if (typeof body.rank === "number" && Number.isInteger(body.rank) && body.rank >= 1) {
      finalRank = body.rank;
    } else if (bounty.payout_type === "single" || !bounty.payout_type) {
      finalRank = 1;
    }

    // Resolve amount in lovelace
    if (typeof body.amount_lovelace === "number" && body.amount_lovelace > 0) {
      finalAmountLovelace = Math.round(body.amount_lovelace);
    } else if (finalRank) {
      const slot = getPrizeSlotAmount(bounty, finalRank);
      finalAmountLovelace = slot.amountLovelace;
    }

    if (finalAmountLovelace && finalAmountLovelace > 0) {
      // Check if allocation already exists for this submission
      const { data: existingAlloc } = await supabaseAdmin
        .from("bounty_payout_allocations")
        .select("id, status")
        .eq("submission_id", id)
        .maybeSingle();

      if (existingAlloc && existingAlloc.status !== "cancelled") {
        const { data: updateRes, error: updateRpcErr } = await supabaseAdmin.rpc("update_bounty_allocation", {
          p_allocation_id: existingAlloc.id,
          p_amount: finalAmountLovelace,
          p_rank: finalRank,
          p_admin_id: adminId,
        });

        if (updateRpcErr || (updateRes && !updateRes.ok)) {
          allocationResult = { ok: false, error: updateRpcErr?.message || updateRes?.error || "Failed to update allocation" };
        } else {
          allocationResult = { ok: true };
        }
      } else {
        const { data: createRes, error: createRpcErr } = await supabaseAdmin.rpc("create_bounty_allocation", {
          p_bounty_id: bounty.id,
          p_submission_id: id,
          p_amount: finalAmountLovelace,
          p_rank: finalRank,
          p_admin_id: adminId,
        });

        if (createRpcErr || (createRes && !createRes.ok)) {
          allocationResult = { ok: false, error: createRpcErr?.message || createRes?.error || "Failed to create allocation" };
        } else {
          allocationResult = { ok: true };
        }
      }
    }
  }

  // Notify the contributor of the review outcome
  const bountyTitle = data.bounties?.title || "Bounty";
  const placementText =
    status === SUBMISSION_STATUS.Approved && finalRank && finalAmountLovelace
      ? ` for ${getRankPlacementLabel(finalRank)} (${(finalAmountLovelace / 1_000_000).toLocaleString()} ADA)`
      : "";

  await createNotification({
    userId: data.contributor_id,
    type:
      status === SUBMISSION_STATUS.Approved
        ? "submission_approved"
        : "submission_rejected",
    title:
      status === SUBMISSION_STATUS.Approved
        ? "Submission Approved! 🎉"
        : "Submission Update",
    message:
      status === SUBMISSION_STATUS.Approved
        ? `Your submission for "${bountyTitle}" was approved${placementText}! 🎉`
        : `Your submission for "${bountyTitle}" was rejected.${data.feedback ? ` Feedback: ${data.feedback}` : ""}`,
    relatedId: data.bounty_id,
  });

  return NextResponse.json({
    ...data,
    allocation: allocationResult,
    rank: finalRank,
    amount_lovelace: finalAmountLovelace,
  });
}
