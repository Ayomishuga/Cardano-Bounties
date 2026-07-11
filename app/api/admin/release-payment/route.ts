import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { LOVELACE_PER_ADA } from "@/lib/bountyContract";

const TX_HASH_PATTERN = /^[0-9a-f]{64}$/i;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const role = req.headers.get("x-user-role");
  const adminId = req.headers.get("x-user-id");

  if (role !== "admin" || !adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  // Explicit rejection of old API shape
  if (body.submission_id !== undefined && body.allocation_id === undefined) {
    return NextResponse.json(
      { error: "submission_id is no longer accepted. Use allocation_id instead." },
      { status: 400 },
    );
  }

  const allocationId =
    typeof body.allocation_id === "string" ? body.allocation_id.trim() : "";
  const txHash =
    typeof body.transaction_hash === "string" ? body.transaction_hash.trim() : "";

  if (!allocationId) {
    return NextResponse.json({ error: "allocation_id is required" }, { status: 400 });
  }

  if (!TX_HASH_PATTERN.test(txHash)) {
    return NextResponse.json(
      { error: "transaction_hash must be a 64 character hex transaction id" },
      { status: 400 },
    );
  }

  // Call transactional RPC
  const { data, error } = await supabaseAdmin.rpc("record_allocation_payment", {
    p_allocation_id: allocationId,
    p_tx_hash:       txHash,
    p_admin_id:      adminId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data.ok) {
    return NextResponse.json({ error: data.error }, { status: 400 });
  }

  // Fetch bounty title for the notification message
  const { data: bounty } = await supabaseAdmin
    .from("bounties")
    .select("title")
    .eq("id", data.bounty_id)
    .single();

  const adaAmount = (Number(data.amount_lovelace) / LOVELACE_PER_ADA).toFixed(2);

  await createNotification({
    userId: data.contributor_id,
    type: "payment_released",
    title: "Payment Released!",
    message: `You've been paid ${adaAmount} ADA for "${bounty?.title ?? "your submission"}".`,
    relatedId: data.bounty_id,
  });

  return NextResponse.json(data);
}
