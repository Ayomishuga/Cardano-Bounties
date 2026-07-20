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

    const body = await req.json()
    const { subject, message } = body

    if (!subject || !message) {
        return NextResponse.json(
            { error: 'subject and message are required' },
            { status: 400 }
        )
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
    const batchSize = 10
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    let sent = 0
    let failed = 0

    for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize)

        const results = await Promise.allSettled(
          batch.map((email) =>
            resend.emails.send({
              from: "Cardano Bounties <onboarding@cardanobounties.com>",
              to: email,
              subject,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
                    <h2 style="color:#0033AD;">${subject}</h2>
                    <p style="color:#333;line-height:1.8;">${message}</p>
                    <br/>
                    <a href="https://cardanobounties.com" 
                        style="background:#0033AD;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">
                        Visit Cardano Bounties →
                    </a>
                    <br/><br/>
                    <p style="color:#999;font-size:12px;">— The Cardano Bounties Team</p>
                </div>
            `,
            }),
          ),
        );
        results.forEach(result => {
            if (result.status === 'fulfilled') sent++
            else failed++
        })

        // Wait 2 seconds between batches to respect rate limits
        if (i + batchSize < emails.length) {
            await sleep(2000)
        }
    }


    const { data: users } = await supabaseAdmin
    .from('users')
    .select('id')

    if (users && users && users.length > 0) {
        await supabaseAdmin
        .from('notifications')
        .insert(
            users.map(user => ({
                user_id: user.id,
                type: 'announcement',
                title: subject,
                message,
                related_id: null
            }))
        )
    }

    
    return NextResponse.json({
        message: 'Announcement sent',
        total: emails.length,
        sent,
        failed
    })
}