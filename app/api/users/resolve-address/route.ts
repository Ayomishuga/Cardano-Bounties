import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import { NextRequest, NextResponse } from "next/server";

const blockfrost = new BlockFrostAPI({
  projectId: process.env.BLOCKFROST_PREPROD_PROJECT_ID!,
});

// GET /api/users/resove-address?stake=stake1...
// Resolve a stake address to its associated payment address
export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get('x-user-role')

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role != 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
  }
  const stakeAddress = req.nextUrl.searchParams.get("stake");

  if (!stakeAddress) {
    return NextResponse.json({ error: "stake is required" }, { status: 400 });
  }

  try {
    const addresses = await blockfrost.accountsAddresses(stakeAddress);

    if (!addresses || addresses.length === 0) {
      return NextResponse.json(
        { error: "No payment address found for this stake address" },
        { status: 404 },
      );
    }

    // Return the most recently used address
    return NextResponse.json({
      payment_address: addresses[0].address,
      all_addresses: addresses.map((a: { address: string }) => a.address),
    });
  } catch (err) {
    const statusCode = (err as {status_code?: number })?.status_code

    // Blockfrost throws 404 if stake address has no transaction history yet
    if (statusCode === 404) {
      return NextResponse.json(
        { error: "Stake address not found on chain or has no activity" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Failed to resolve payment address" },
      { status: 500 },
    );
  }
}
