import { verifyEscrowPayment } from "@/lib/blockfrost";
import { adaToLovelace } from "@/lib/cardano/amounts";
import { BOUNTY_STATUS } from "@/lib/bountyContract";
import { supabaseAdmin } from "@/lib/supabase";

export type EscrowBountyRecord = {
  id: string;
  status: string;
  total_funding_amount: number | string | null;
  escrow_tx_hash?: string | null;
  escrow_address?: string | null;
  escrow_verification_attempts?: number | null;
};

export type EscrowFinalizeResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; retryable: boolean; data?: Record<string, unknown> | null };

export async function verifyAndFinalizeEscrow(bounty: EscrowBountyRecord): Promise<EscrowFinalizeResult> {
  if (!bounty.escrow_tx_hash || !bounty.escrow_address) {
    return {
      ok: false,
      status: 400,
      error: "Bounty does not have a recorded escrow transaction.",
      retryable: false,
    };
  }

  const now = new Date().toISOString();
  const expectedLovelace = adaToLovelace(Number(bounty.total_funding_amount));
  const verification = await verifyEscrowPayment({
    txHash: bounty.escrow_tx_hash,
    escrowAddress: bounty.escrow_address,
    expectedLovelace,
  });

  if (!verification.ok) {
    const updates: Record<string, unknown> = {
      escrow_last_checked_at: now,
      escrow_verification_attempts: Number(bounty.escrow_verification_attempts || 0) + 1,
      escrow_verification_error: verification.error,
    };

    await supabaseAdmin
      .from("bounties")
      .update(updates)
      .eq("id", bounty.id);

    return {
      ok: false,
      status: verification.status || 400,
      error: verification.error,
      retryable: verification.status === 425,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("bounties")
    .update({
      escrow_confirmed_at: now,
      escrow_last_checked_at: now,
      escrow_verification_attempts: Number(bounty.escrow_verification_attempts || 0) + 1,
      escrow_verification_error: null,
      status: BOUNTY_STATUS.AwaitingAdminReview,
    })
    .eq("id", bounty.id)
    .select()
    .single();

  if (error) {
    return {
      ok: false,
      status: 500,
      error: error.message,
      retryable: false,
    };
  }

  return { ok: true, data: data as Record<string, unknown> };
}
