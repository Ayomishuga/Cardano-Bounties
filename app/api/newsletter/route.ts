import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/newsletter
 * Subscribes an email to the newsletter list.
 * Reuses the existing `waitlist` table — same infrastructure,
 * just different copy/context in the UI.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Email address is required." }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // Insert into the existing waitlist table (de-duplicated by unique constraint)
  const { error } = await supabaseAdmin.from("waitlist").insert({ email });

  if (error) {
    if (error.code === "23505") {
      // Already subscribed — treat as success so we don't reveal existing emails
      return NextResponse.json({ message: "You're already subscribed!" }, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify admin
  try {
    await Promise.all([
      resend.emails.send({
        from: "Cardano Bounties <onboarding@resend.dev>",
        to: process.env.ADMIN_EMAIL!,
        subject: "New Newsletter Subscriber",
        html: `<p>New newsletter subscriber: <strong>${email}</strong></p>`,
      }),
      resend.emails.send({
        from: "Cardano Bounties <onboarding@cardanobounties.com>",
        to: email,
        subject: "You're subscribed to Cardano Bounties updates!",
        html: `
          <div style="font-family:Arial,sans-serif;background:#060c1a;color:#e5e9f0;padding:40px 24px;border-radius:12px;max-width:560px;margin:0 auto;">
            <img src="https://cardanobounties.com/og-image.jpg" alt="Cardano Bounties" style="width:160px;margin-bottom:24px;" />
            <h2 style="color:#4a9eff;margin:0 0 12px;">You're subscribed! 🎉</h2>
            <p style="margin:0 0 16px;">Thanks for subscribing to Cardano Bounties updates. We'll keep you in the loop on new bounties, platform news, and ADA earning opportunities.</p>
            <p style="color:#8a9099;font-size:13px;">No spam — only updates that matter. You can unsubscribe at any time.</p>
          </div>
        `,
      }),
    ]);
  } catch (err) {
    console.error("Newsletter email error:", err);
  }

  return NextResponse.json({ message: "Successfully subscribed!" }, { status: 201 });
}
