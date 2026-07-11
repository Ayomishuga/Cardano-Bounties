import { NextRequest, NextResponse } from "next/server";
import { BOUNTY_STATUS } from "@/lib/bountyContract";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const role = req.headers.get("x-user-role");
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: bountyId } = await params;

  const { data: bounty, error: fetchError } = await supabaseAdmin
    .from("bounties")
    .select("id, status")
    .eq("id", bountyId)
    .single();

  if (fetchError || !bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  if (bounty.status !== BOUNTY_STATUS.Open) {
    return NextResponse.json(
      { error: "Only open bounties can be moved to in_review" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("bounties")
    .update({ status: BOUNTY_STATUS.InReview, updated_at: new Date().toISOString() })
    .eq("id", bountyId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
