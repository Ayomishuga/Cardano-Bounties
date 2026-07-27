import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateNonce } from "@meshsdk/core";

// Generate a random nonce for the wallet to sign.
// Also accepts an optional `payment_address` (the wallet's change / base address,
// addr1...) so we can store it for payouts even when the stake address has no
// on-chain activity.
export async function GET(req: NextRequest): Promise<NextResponse> {
    const address = req.nextUrl.searchParams.get('address')
    // Optional: full base address (addr1...) sent by the front-end at sign-in time
    const paymentAddress = req.nextUrl.searchParams.get('payment_address') || null

    if (!address) {
        return NextResponse.json({ error: 'address is required' }, { status: 400 })
    }

    try {
        const nonce = generateNonce('Sign in to Cardano Bounties: ')
        const nonce_expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString()

        const { data: existingUser, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('stake_address', address)
        .single()

        if (fetchError && fetchError.code !== 'PGRST116') {
            // PGRST116 = row not found, which is expected for new users
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        if (existingUser) {
            // Always refresh the payment_address if a newer one is provided
            const updatePayload: Record<string, unknown> = { nonce, nonce_expires_at }
            if (paymentAddress) updatePayload.payment_address = paymentAddress

            const { error } = await supabaseAdmin
            .from('users')
            .update(updatePayload)
            .eq('stake_address', address)

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 })
            }
        } else {
            const { error } = await supabaseAdmin
            .from('users')
            .insert({
                stake_address: address,
                nonce,
                nonce_expires_at,
                role: 'contributor',
                ...(paymentAddress ? { payment_address: paymentAddress } : {}),
            })

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 })
            }
        }

        return NextResponse.json({nonce})
    } catch (e) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
