import { NextRequest, NextResponse } from "next/server";
import { BOUNTY_STATUS } from "@/lib/bountyContract";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";

/**
 * POST /api/cron/expire-bounties
 *
 * Called daily at midnight UTC by Vercel Cron.
 * Protected by CRON_SECRET — Vercel sets the Authorization header automatically.
 *
 * Two passes per run:
 *  1. Warning pass  — bounties expiring in exactly 7 days → notify poster
 *  2. Expiry pass   — open bounties past their deadline:
 *       • Has ≥1 approved submission  → status: in_review + notify poster
 *       • No approved submissions     → status: expired  + notify poster
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // ----- Auth guard -----
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ----- Date helpers -----
  // Work in UTC date strings (YYYY-MM-DD) to match how deadline is stored
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const warningDate = new Date(todayUtc);
  warningDate.setUTCDate(warningDate.getUTCDate() + 7);

  const todayStr = todayUtc.toISOString().slice(0, 10);
  const warningStr = warningDate.toISOString().slice(0, 10);

  let warned = 0;
  let movedToReview = 0;
  let expired = 0;

  // ================================================================
  // PASS 1 — 7-day warning notifications
  // ================================================================
  const { data: warnBounties, error: warnError } = await supabaseAdmin
    .from("bounties")
    .select("id, title, created_by")
    .eq("status", BOUNTY_STATUS.Open)
    .eq("deadline", warningStr);

  if (warnError) {
    console.error("[expire-bounties] Warning pass query failed:", warnError);
  } else if (warnBounties && warnBounties.length > 0) {
    await Promise.all(
      warnBounties.map((bounty) =>
        createNotification({
          userId: bounty.created_by,
          type: "bounty_expiring_soon",
          title: "Bounty Expiring Soon ⏰",
          message: `Your bounty "${bounty.title}" expires in 7 days. Extend the deadline or let it expire.`,
          relatedId: bounty.id,
        }),
      ),
    );
    warned = warnBounties.length;
  }

  // ================================================================
  // PASS 2 — Expiry enforcement
  // Fetch all open bounties whose deadline has passed, with submissions
  // ================================================================
  const { data: pastDeadlineBounties, error: expiryQueryError } = await supabaseAdmin
    .from("bounties")
    .select(
      `
        id,
        title,
        created_by,
        submissions (
          id,
          status
        )
      `,
    )
    .eq("status", BOUNTY_STATUS.Open)
    .lt("deadline", todayStr);

  if (expiryQueryError) {
    console.error("[expire-bounties] Expiry pass query failed:", expiryQueryError);
    return NextResponse.json(
      { error: "Expiry query failed", details: expiryQueryError.message },
      { status: 500 },
    );
  }

  if (!pastDeadlineBounties || pastDeadlineBounties.length === 0) {
    return NextResponse.json({ warned, movedToReview, expired });
  }

  // Partition bounties: those with ≥1 approved submission vs those without
  const toReviewIds: string[] = [];
  const toExpireIds: string[] = [];

  for (const bounty of pastDeadlineBounties) {
    const submissions = (bounty.submissions ?? []) as Array<{ status: string }>;
    const hasApproved = submissions.some((s) => s.status === "approved");
    if (hasApproved) {
      toReviewIds.push(bounty.id);
    } else {
      toExpireIds.push(bounty.id);
    }
  }

  const now = new Date().toISOString();

  // Batch-update bounties with approved submissions → in_review
  if (toReviewIds.length > 0) {
    const { error: reviewErr } = await supabaseAdmin
      .from("bounties")
      .update({ status: BOUNTY_STATUS.InReview, updated_at: now })
      .in("id", toReviewIds);

    if (reviewErr) {
      console.error("[expire-bounties] Failed to move bounties to in_review:", reviewErr);
    } else {
      movedToReview = toReviewIds.length;

      // Notify each poster
      const reviewBounties = pastDeadlineBounties.filter((b) => toReviewIds.includes(b.id));
      await Promise.all(
        reviewBounties.map((bounty) =>
          createNotification({
            userId: bounty.created_by,
            type: "bounty_auto_reviewed",
            title: "Bounty Moved to Review 📋",
            message: `Your bounty "${bounty.title}" has passed its deadline and has been moved to review because approved submissions were received.`,
            relatedId: bounty.id,
          }),
        ),
      );
    }
  }

  // Batch-update bounties with no approved submissions → expired
  if (toExpireIds.length > 0) {
    const { error: expireErr } = await supabaseAdmin
      .from("bounties")
      .update({ status: BOUNTY_STATUS.Expired, updated_at: now })
      .in("id", toExpireIds);

    if (expireErr) {
      console.error("[expire-bounties] Failed to expire bounties:", expireErr);
    } else {
      expired = toExpireIds.length;

      // Notify each poster
      const expiredBounties = pastDeadlineBounties.filter((b) => toExpireIds.includes(b.id));
      await Promise.all(
        expiredBounties.map((bounty) =>
          createNotification({
            userId: bounty.created_by,
            type: "bounty_expired",
            title: "Bounty Expired",
            message: `Your bounty "${bounty.title}" has expired with no approved submissions. Contact admin if a refund is needed.`,
            relatedId: bounty.id,
          }),
        ),
      );
    }
  }

  return NextResponse.json({ warned, movedToReview, expired });
}
