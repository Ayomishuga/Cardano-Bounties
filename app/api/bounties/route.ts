import { NextRequest, NextResponse } from "next/server";
import { BOUNTY_STATUS, validateCreateBountyPayload } from "@/lib/bountyContract";
import { supabaseAdmin } from "@/lib/supabase";

const DEFAULT_PAGE_SIZE = 9;
const MAX_PAGE_SIZE = 24;

function getPositiveInt(value: string | null, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// Get /api/bounties
export async function GET(req: NextRequest): Promise<NextResponse> {
    const page = getPositiveInt(req.nextUrl.searchParams.get('page'), 1);
    const pageSize = Math.min(getPositiveInt(req.nextUrl.searchParams.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const search = req.nextUrl.searchParams.get('search')?.trim() || '';
    const type = req.nextUrl.searchParams.get('type')?.trim() || '';
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
    .from('bounties')
    .select(`
        *,
        projects (
        id,
        name,
        logo_url
        )
        `, { count: 'exact' })
    .in('status', [BOUNTY_STATUS.Open, BOUNTY_STATUS.InReview])
    .order('created_at', {ascending: false})

    if (type && type !== 'all') {
        query = query.eq('type', type)
    }

    if (search) {
        const escapedSearch = search.replace(/[%_]/g, '\\$&')
        query = query.or(
            `title.ilike.%${escapedSearch}%,description.ilike.%${escapedSearch}%,type.ilike.%${escapedSearch}%,custom_type.ilike.%${escapedSearch}%,project_name.ilike.%${escapedSearch}%`
        )
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
        return NextResponse.json({ error: error.message }, {status: 500 })
    }

    const total = count || 0;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    return NextResponse.json({
        data,
        pagination: {
            page,
            pageSize,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
        }
    })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    const userId = req.headers.get('x-user-id')

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = validateCreateBountyPayload(body)

    if (!validated.ok) {
        return NextResponse.json(
            { error: validated.error, field: validated.field },
            { status: 400 }
        )
    }

    const {
        title,
        description,
        type,
        custom_type,
        reward_amount,
        platform_fee_amount,
        total_funding_amount,
        deadline,
        project_id,
        project_name,
        project_logo_url,
        bounty_instructions,
        payout_type,
        max_winners,
        prize_structure,
    } = validated.value

    const {data, error} = await supabaseAdmin
    .from('bounties')
    .insert({
        title,
        description,
        type,
        custom_type,
        reward_amount,
        platform_fee_amount,
        total_funding_amount,
        deadline,
        project_id,
        project_name,
        project_logo_url,
        bounty_instructions,
        payout_type,
        max_winners,
        prize_structure,
        created_by: userId,
        status: BOUNTY_STATUS.PendingEscrow
    })
    .select()
    .single()

    if (error) {
        return NextResponse.json({error: error.message}, {status: 500})
    }

    return NextResponse.json(data, { status: 201 })
}
