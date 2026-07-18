import { NextRequest, NextResponse } from "next/server";
import { BOUNTY_STATUS } from "@/lib/bountyContract";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role");

  const { data, error } = await supabaseAdmin
    .from("bounties")
    .select(
      `
        *,
        submissions (
          id,
          contributor_id,
          status,
          submitted_at,
          reviewed_at
        ),
        projects (
        id,
        name,
        logo_url
        )
      `,
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  const isPubliclyViewable = [BOUNTY_STATUS.Open, BOUNTY_STATUS.InReview].includes(data.status);

  if (!isPubliclyViewable) {
    if (!userId || (data.created_by !== userId && role !== "admin")) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }
  }

  return NextResponse.json(data);
}

// PATCH /api/admin/bounties/[id] -- approve or reject a bounty
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const role = req.headers.get("x-user-role");

  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { status } = body;

  if (
    !status ||
    ![BOUNTY_STATUS.Open, BOUNTY_STATUS.Rejected].includes(status)
  ) {
    return NextResponse.json(
      { error: "status must be open, cancelled or rejected (reject)" },
      { status: 400 },
    );
  }

  // Check bounty is awaiting review
  const { data: bounty, error: fetchError } = await supabaseAdmin
    .from("bounties")
    .select("id, status, title, created_by")
    .eq("id", id)
    .single();

  if (fetchError || !bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  if (bounty.status !== BOUNTY_STATUS.AwaitingAdminReview) {
    return NextResponse.json(
      { error: "Bounty is not awaiting admin review" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("bounties")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify the poster of the review outcome
  await createNotification({
    userId: bounty.created_by,
    type: status === BOUNTY_STATUS.Open ? "bounty_approved" : "bounty_rejected",
    title:
      status === BOUNTY_STATUS.Open ? "Bounty Approved! 🎉" : "Bounty Rejected",
    message:
      status === BOUNTY_STATUS.Open
        ? `Your bounty "${bounty.title}" is now live and open for submissions.`
        : `Your bounty "${bounty.title}" was rejected by the admin.`,
    relatedId: id,
  });

  return NextResponse.json(data);
}

// DELETE /api/bounties/[id] -- poster invalidates an unfunded bounty
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const userId = req.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: bounty, error: fetchError } = await supabaseAdmin
    .from("bounties")
    .select("id, status, created_by")
    .eq("id", id)
    .single();

  if (fetchError || !bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  if (bounty.created_by !== userId) {
    return NextResponse.json(
      { error: "You can only invalidate your own bounty" },
      { status: 403 },
    );
  }

  if (bounty.status !== BOUNTY_STATUS.PendingEscrow) {
    return NextResponse.json(
      { error: "Only unfunded pending bounties can be invalidated" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("bounties")
    .update({
      status: BOUNTY_STATUS.Cancelled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
