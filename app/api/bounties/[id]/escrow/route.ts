import { NextRequest, NextResponse } from "next/server";
import { BOUNTY_STATUS, validateEscrowPayload } from "@/lib/bountyContract";
import { verifyAndFinalizeEscrow } from "@/lib/escrowVerification";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const userId = req.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const configuredEscrowAddress =
    process.env.ESCROW_ADDRESS || process.env.NEXT_PUBLIC_ESCROW_ADDRESS;

  if (!configuredEscrowAddress) {
    return NextResponse.json(
      { error: "Escrow address is not configured" },
      { status: 500 },
    );
  }

  const validated = validateEscrowPayload(body, configuredEscrowAddress);

  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error, field: validated.field },
      { status: 400 },
    );
  }

  const { escrow_tx_hash, escrow_address } = validated.value;

  const { data: bounty, error: fetchError } = await supabaseAdmin
    .from("bounties")
    .select(
      `
        id,
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
    // Surface Supabase error for debugging (temporary)
    console.error("Supabase fetch error for bounty id", id, fetchError);
    const debug = fetchError ? (fetchError.message || fetchError) : undefined;
    return NextResponse.json({ error: "Bounty not found", debug }, { status: 404 });
  }

  if (bounty.created_by !== userId) {
    return NextResponse.json(
      { error: "You can only escrow your own bounties" },
      { status: 403 },
    );
  }

  if (bounty.status === BOUNTY_STATUS.AwaitingAdminReview && bounty.escrow_confirmed_at) {
    return NextResponse.json(bounty);
  }

  if (bounty.status !== BOUNTY_STATUS.PendingEscrow) {
    return NextResponse.json(
      { error: "Bounty is not in pending_escrow status" },
      { status: 400 },
    );
  }

  if (bounty.escrow_tx_hash && bounty.escrow_tx_hash !== escrow_tx_hash) {
    return NextResponse.json(
      {
        error: "This bounty already has a different escrow transaction recorded.",
        escrow_tx_hash: bounty.escrow_tx_hash,
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const { data: recordedBounty, error: recordError } = await supabaseAdmin
    .from("bounties")
    .update({
      escrow_tx_hash,
      escrow_address,
      escrow_submitted_at: bounty.escrow_submitted_at || now,
      escrow_last_checked_at: now,
    })
    .eq("id", id)
    .select(
      `
        id,
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
    .single();

  if (recordError || !recordedBounty) {
    return NextResponse.json(
      { error: recordError?.message || "Unable to record escrow transaction." },
      { status: 500 },
    );
  }

  const verification = await verifyAndFinalizeEscrow(recordedBounty);

  if (!verification.ok) {
    const responseStatus = verification.retryable ? 202 : verification.status;
    return NextResponse.json(
      {
        error: verification.error,
        retryable: verification.retryable,
        verification_pending: verification.retryable,
        escrow_tx_hash,
        bounty: recordedBounty,
      },
      { status: responseStatus },
    );
  }

  return NextResponse.json(verification.data);
}
