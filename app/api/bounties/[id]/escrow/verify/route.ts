import { NextRequest, NextResponse } from "next/server";
import { BOUNTY_STATUS } from "@/lib/bountyContract";
import { verifyAndFinalizeEscrow } from "@/lib/escrowVerification";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: bounty, error: fetchError } = await supabaseAdmin
    .from("bounties")
    .select(
      `
        id,
        title,
        status,
        created_by,
        total_funding_amount,
        escrow_tx_hash,
        escrow_address,
        escrow_submitted_at,
        escrow_confirmed_at,
        escrow_verification_attempts
      `,
    )
    .eq("id", id)
    .single();

  if (fetchError || !bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  if (role !== "admin" && bounty.created_by !== userId) {
    return NextResponse.json(
      { error: "You can only verify escrow for your own bounties" },
      { status: 403 },
    );
  }

  if (bounty.status === BOUNTY_STATUS.AwaitingAdminReview && bounty.escrow_confirmed_at) {
    return NextResponse.json(bounty);
  }

  if (bounty.status !== BOUNTY_STATUS.PendingEscrow) {
    return NextResponse.json(
      { error: "Only pending escrow bounties can be verified" },
      { status: 400 },
    );
  }

  const verification = await verifyAndFinalizeEscrow(bounty);

  if (!verification.ok) {
    return NextResponse.json(
      {
        error: verification.error,
        retryable: verification.retryable,
        verification_pending: verification.retryable,
        escrow_tx_hash: bounty.escrow_tx_hash,
      },
      { status: verification.retryable ? 202 : verification.status },
    );
  }

  return NextResponse.json(verification.data);
}
