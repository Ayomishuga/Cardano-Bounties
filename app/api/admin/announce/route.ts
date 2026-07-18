import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY)

// POST /api/admin/announce -- send launch email to entire waitlist
export async function POST(req: NextRequest): Promise<NextResponse> {
    const role = req.headers.get('x-user-role')

    if (role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all waitlist emails
    const { data: waitlist, error } = await supabaseAdmin.from('waitlist').select('email')

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!waitlist || waitlist.length === 0) {
        return NextResponse.json({ message: 'No emails on waitlist' }, { status: 200 })
    }

    const emails = waitlist.map(w => w.email)

    // Send in batches of 50 ro respect Resend rate limits
    const batchSize = 50
    let sent = 0
    let failed = 0

    for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize)

        const results = await Promise.allSettled(
            batch.map(email => 
                resend.emails.send({
                    from: 'Cardano Bounties <onboarding@cardanobounties.com>',
                    to: email,
                    subject: "Cardano Bounties Beta Testing is Live!",
                    html: `
                    <h2>Great news! Cardano Bounties Beta Testing Phase is now live!</h2>
                    <p>As one of our waitlist members, you're among the first to get access to the platform. We invite you to explore, test the features, and share feedback with us.</p>
                    <p>Your input will help us improve the platform and ensure we're fully prepared for the mainnet launch.</p>
                    <br />
                    <p>
                    Check out the 
                    <span>
                    <a href="https://x.com/cardanobounties/status/2074188787735838938?s=46">post on X</a>
                    </span> to learn about step-by-step guide on how to test and other necessary details you need.
                    </p>
                    <br/>
                    <br/>
                    <p>- The Cardano Bounties Team</p>
                    `
                })
            )
        )
        results.forEach(result => {
            if (result.status === 'fulfilled') sent++
            else failed++
        })
    }
    
    return NextResponse.json({
        message: 'Announcement sent',
        total: emails.length,
        sent,
        failed
    })
}