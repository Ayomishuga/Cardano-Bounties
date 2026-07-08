import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";
import { readFileSync } from "fs";
import { join } from "path";

const resend = new Resend(process.env.RESEND_API_KEY)

// POST /api/waitlist -- add email to waitlist
export async function POST(req: NextRequest) {
    const body = await req.json()
    const { email } = body

    if (!email) {
        return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'invalid email address' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
    .from('waitlist')
    .insert({ email })

    if (error) {
        // Duplicate email
        if (error.code === '23505') {
            return NextResponse.json(
                { error: 'email already on waitlist'},
                { status: 409 }
            )
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const templatePath = join(process.cwd(), 'public', 'message.html')
    let html = readFileSync(templatePath, 'utf-8')

    html = html.replace('$new Date().getFullYear()}', new Date().getFullYear().toString())

    try {
        const results = await Promise.all([
      // Notify admin
      resend.emails.send({
        from: "Cardano Bounties <onboarding@resend.dev>",
        to: process.env.ADMIN_EMAIL!,
        subject: "New Waitlist Signup",
        html: `<p>A new user joined the waitlist: <strong>${email}</strong></p>`,
      }),

      // Confirm to user
      resend.emails.send({
        from: "Cardano Bounties <onboarding@cardanobounties.com>",
        to: email,
        subject: "You're on the Cardano Bounties waitlist!",
        html,
      }),
    ])
    } catch (err) {
        console.error('Email error:', err)
    }
    return NextResponse.json({ message: 'Successfully joined waitlist'}, { status: 201 })
}

// GET /api/waitlist -- get waitlist count
export async function GET(): Promise<NextResponse> {
    const { count, error } = await supabaseAdmin
        .from('waitlist')
        .select('*', { count: 'exact', head: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ count: count || 0 })
}