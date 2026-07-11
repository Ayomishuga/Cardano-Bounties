import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

// GET /api/admin/allocations?bounty_id=<uuid>
export async function GET(req: NextRequest): Promise<NextResponse> {
  const role = req.headers.get("x-user-role");
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bountyId = req.nextUrl.searchParams.get("bounty_id");
  if (!bountyId) {
    return NextResponse.json({ error: "bounty_id is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("bounty_payout_allocations")
    .select(`
      *,
      submissions ( id, content, submitted_at ),
      users!contributor_id ( id, stake_address, display_name )
    `)
    .eq("bounty_id", bountyId)
    .order("rank", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/admin/allocations
export async function POST(req: NextRequest): Promise<NextResponse> {
  const role = req.headers.get("x-user-role");
  const adminId = req.headers.get("x-user-id");

  if (role !== "admin" || !adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const bountyId = typeof body.bounty_id === "string" ? body.bounty_id.trim() : "";
  const submissionId = typeof body.submission_id === "string" ? body.submission_id.trim() : "";
  const amountLovelace = Number(body.amount_lovelace);
  const rank = typeof body.rank === "number" ? body.rank : null;

  if (!bountyId) return NextResponse.json({ error: "bounty_id is required" }, { status: 400 });
  if (!submissionId) return NextResponse.json({ error: "submission_id is required" }, { status: 400 });
  if (!Number.isInteger(amountLovelace) || amountLovelace <= 0) {
    return NextResponse.json({ error: "amount_lovelace must be a positive integer" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("create_bounty_allocation", {
    p_bounty_id:     bountyId,
    p_submission_id: submissionId,
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

  return NextResponse.json({ ok: true }, { status: 201 });
}
