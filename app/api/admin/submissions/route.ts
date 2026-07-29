import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
    const role = req.headers.get('x-user-role')

    if (role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const status = req.nextUrl.searchParams.get('status')

    let query = supabaseAdmin
    .from('submissions')
    .select(`
        *,
        bounties ( id, title, reward_amount, type ),
        users ( id, stake_address, display_name )
        `)
        .order('submitted_at', { ascending: false })

        // Apply status filter if provided
        if (status) {
            query = query.eq('status', status)
        }

        const { data, error } = await query

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data)
}