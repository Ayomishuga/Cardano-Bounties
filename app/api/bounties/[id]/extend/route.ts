import { NextRequest, NextResponse } from "next/server";
import { BOUNTY_STATUS, MAX_DEADLINE_EXTENSIONS, MIN_EXTENSION_DAYS } from "@/lib/bountyContract";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * PATCH /api/bounties/[id]/extend
 * Body: { new_deadline: "YYYY-MM-DD" }
 *
 * Allows the bounty poster to self-extend the deadline of an open bounty.
 * Rules:
 *  - Caller must be the poster (created_by === x-user-id)
 *  - Bounty must be status: open
 *  - deadline_extended_count must be < MAX_DEADLINE_EXTENSIONS (2)
 *  - new_deadline must be a valid YYYY-MM-DD date
 *  - new_deadline must be at least MIN_EXTENSION_DAYS (7) days from today
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const userId = req.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---- Parse body ----
  const body = await req.json().catch(() => ({}));
  const newDeadline =
    typeof body.new_deadline === "string" ? body.new_deadline.trim() : "";

  // ---- Validate new_deadline format ----
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!newDeadline || !datePattern.test(newDeadline)) {
    return NextResponse.json(
      { error: "new_deadline must be a valid date in YYYY-MM-DD format", field: "new_deadline" },
      { status: 400 },
    );
  }

  // ---- Validate new_deadline is far enough in the future ----
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const minAllowed = new Date(todayUtc);
  minAllowed.setUTCDate(minAllowed.getUTCDate() + MIN_EXTENSION_DAYS);

  const [year, month, day] = newDeadline.split("-").map(Number);
  const deadlineUtc = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(deadlineUtc.getTime()) || deadlineUtc < minAllowed) {
    return NextResponse.json(
      {
        error: `new_deadline must be at least ${MIN_EXTENSION_DAYS} days from today (${minAllowed.toISOString().slice(0, 10)} or later)`,
        field: "new_deadline",
      },
      { status: 400 },
    );
  }

  // ---- Fetch bounty ----
  const { data: bounty, error: fetchError } = await supabaseAdmin
    .from("bounties")
    .select("id, status, created_by, title, deadline_extended_count")
    .eq("id", id)
    .single();

  if (fetchError || !bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  // ---- Poster-only guard ----
  if (bounty.created_by !== userId) {
    return NextResponse.json(
      { error: "You can only extend your own bounty" },
      { status: 403 },
    );
  }

  // ---- Bounty must be open ----
  if (bounty.status !== BOUNTY_STATUS.Open) {
    return NextResponse.json(
      { error: "Only open bounties can have their deadline extended" },
      { status: 400 },
    );
  }

  // ---- Extension limit check ----
  const currentCount = bounty.deadline_extended_count ?? 0;
  if (currentCount >= MAX_DEADLINE_EXTENSIONS) {
    return NextResponse.json(
      {
        error: `Bounty has reached the maximum of ${MAX_DEADLINE_EXTENSIONS} deadline extensions`,
      },
      { status: 409 },
    );
  }

  // ---- Apply extension ----
  const { data, error: updateError } = await supabaseAdmin
    .from("bounties")
    .update({
      deadline: newDeadline,
      deadline_extended_count: currentCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
