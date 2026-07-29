import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

async function getContributorProfile(contributorId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, stake_address, display_name, role")
    .eq("id", contributorId)
    .single();

  return data || null;
}

// POST
export async function POST(req: NextRequest) {
  const contributorId =
    req.headers.get("x-user-id") || req.headers.get("x-wallet-address");

  if (!contributorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { bounty_id, content } = body;

  if (!bounty_id || !content) {
    return NextResponse.json(
      { error: "bounty_id and content are required" },
      { status: 400 },
    );
  }

  const { data: bounty, error: bountyError } = await supabaseAdmin
    .from("bounties")
    .select("id, status, title, created_by")
    .eq("id", bounty_id)
    .single();

  if (bountyError || !bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  if (bounty.status === "in_review") {
    return NextResponse.json(
      { error: "This bounty is under review and no longer accepting submissions" },
      { status: 400 },
    );
  }

  if (bounty.status !== "open") {
    return NextResponse.json(
      { error: "Bounty is no longer open" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("submissions")
    .insert({ bounty_id, contributor_id: contributorId, content }) // ← fixed
    .select()
    .single();

  if (error) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "you have already submitted to this bounty" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  // Notify the poster of the new submission
  await createNotification({
    userId: bounty.created_by,
    type: "new_submission",
    title: "New Submission Received",
    message: `Someone submitted work for your bounty "${bounty.title}".`,
    relatedId: bounty_id,
  });

  const contributor = await getContributorProfile(contributorId);

  return NextResponse.json({ ...data, contributor }, { status: 201 });
}
