import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateNonce } from "@meshsdk/core";

// Generate a random nonce for the wallet to sign
export async function GET(req: NextRequest): Promise<NextResponse> {
    const address = req.nextUrl.searchParams.get('address')

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
            const { error } = await supabaseAdmin
            .from('users')
            .update({ nonce, nonce_expires_at })
            .eq('stake_address', address)

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 })
            }
        } else {
            const { error } = await supabaseAdmin
            .from('users')
            .insert({ stake_address: address, nonce, nonce_expires_at, role: 'contributor' })

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 })
            }
        }

        return NextResponse.json({nonce})
    } catch (e) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
