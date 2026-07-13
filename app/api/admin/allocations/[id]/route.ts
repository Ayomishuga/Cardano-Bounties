import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// PATCH /api/admin/allocations/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const role = req.headers.get("x-user-role");
  const adminId = req.headers.get("x-user-id");

  if (role !== "admin" || !adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: allocationId } = await params;
  const body = await req.json();
  const amountLovelace = Number(body.amount_lovelace);
  const rank = typeof body.rank === "number" ? body.rank : null;

  if (!Number.isInteger(amountLovelace) || amountLovelace <= 0) {
    return NextResponse.json({ error: "amount_lovelace must be a positive integer" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("update_bounty_allocation", {
    p_allocation_id: allocationId,
    p_amount:        amountLovelace,
    p_rank:          rank,
    p_admin_id:      adminId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data.ok) {
    return NextResponse.json({ error: data.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/allocations/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const role = req.headers.get("x-user-role");
  const adminId = req.headers.get("x-user-id");

  if (role !== "admin" || !adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: allocationId } = await params;

  const { data, error } = await supabaseAdmin.rpc("cancel_bounty_allocation", {
    p_allocation_id: allocationId,
    p_admin_id:      adminId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data.ok) {
    return NextResponse.json({ error: data.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
