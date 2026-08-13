import { NextRequest, NextResponse } from "next/server";
import { BOUNTY_STATUS, SUBMISSION_STATUS } from "@/lib/bountyContract";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

const REFUNDABLE_STATUSES = [
  BOUNTY_STATUS.AwaitingAdminReview,
  BOUNTY_STATUS.Open,
  BOUNTY_STATUS.Cancelled,
  BOUNTY_STATUS.Rejected,
  BOUNTY_STATUS.Expired,
];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const role = req.headers.get("x-user-role");

  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const bountyId =
    typeof body.bounty_id === "string" ? body.bounty_id.trim() : "";
  const refundTxHash =
    typeof body.transaction_hash === "string"
      ? body.transaction_hash.trim()
      : "";

  if (!bountyId) {
    return NextResponse.json(
      { error: "bounty_id is required" },
      { status: 400 },
    );
  }

  if (!/^[0-9a-f]{64}$/i.test(refundTxHash)) {
    return NextResponse.json(
      { error: "transaction_hash must be a 64 character hex transaction id" },
      { status: 400 },
    );
  }

  const { data: bounty, error: fetchError } = await supabaseAdmin
    .from("bounties")
    .select("id, status, title, created_by, refund_tx_hash")
    .eq("id", bountyId)
    .single();

  if (fetchError || !bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  if (bounty.refund_tx_hash) {
    return NextResponse.json(
      { error: "Bounty has already been refunded" },
      { status: 409 },
    );
  }

  if (!REFUNDABLE_STATUSES.includes(bounty.status)) {
    return NextResponse.json(
      { error: "Bounty is not in a refundable status" },
      { status: 400 },
    );
  }

  const { data: pendingSubmissions } = await supabaseAdmin
    .from("submissions")
    .select("id, contributor_id")
    .eq("bounty_id", bountyId)
    .eq("status", SUBMISSION_STATUS.Pending);

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("bounties")
    .update({
      status: BOUNTY_STATUS.Cancelled,
      refund_tx_hash: refundTxHash,
      refunded_at: now,
      updated_at: now,
    })
    .eq("id", bountyId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseAdmin
    .from("submissions")
    .update({ status: SUBMISSION_STATUS.Closed, updated_at: now })
    .eq("bounty_id", bountyId)
    .eq("status", SUBMISSION_STATUS.Pending);

  await createNotification({
    userId: bounty.created_by,
    type: "bounty_rejected",
    title: "Escrow Refunded",
    message: `Your escrow for "${bounty.title}" has been refunded.`,
    relatedId: bountyId,
  });

  if (pendingSubmissions && pendingSubmissions.length > 0) {
    await Promise.all(
      pendingSubmissions.map((Submission) =>
        createNotification({
          userId: Submission.contributor_id,
          type: "submission_rejected",
          title: "Bounty Cancelled",
          message: `The bounty "${bounty.title}" has been cancelled. Your submission has been closed.`,
          relatedId: bountyId,
        }),
      ),
    );
  }

  return NextResponse.json(data);
}
