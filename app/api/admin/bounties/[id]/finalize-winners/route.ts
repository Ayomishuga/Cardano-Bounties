import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const role = req.headers.get("x-user-role");
  const adminId = req.headers.get("x-user-id");

  if (role !== "admin" || !adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: bountyId } = await params;

  // Call the transactional RPC
  const { data, error } = await supabaseAdmin.rpc("finalize_bounty_winners", {
    p_bounty_id: bountyId,
    p_admin_id:  adminId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data.ok) {
    return NextResponse.json({ error: data.error }, { status: 400 });
  }

  // Fire not_selected notifications for affected contributors
  const { data: notSelected } = await supabaseAdmin
    .from("submissions")
    .select("contributor_id, bounty_id, bounties(title)")
    .eq("bounty_id", bountyId)
    .eq("status", "not_selected");

  if (notSelected && notSelected.length > 0) {
    const bountyTitle = (notSelected[0]?.bounties as { title?: string } | null)?.title ?? "this bounty";
    await Promise.allSettled(
      notSelected.map((s) =>
        createNotification({
          userId: s.contributor_id,
          type: "submission_not_selected",
          title: "Submission Not Selected",
          message: `Your submission for "${bountyTitle}" was not selected as a winner.`,
          relatedId: bountyId,
        }),
      ),
    );
  }

  return NextResponse.json({ ok: true, bounty_status: "payout_pending" });
}
