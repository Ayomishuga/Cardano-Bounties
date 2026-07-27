import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const blockfrost = new BlockFrostAPI({
  projectId: process.env.BLOCKFROST_PREPROD_PROJECT_ID!,
});

// GET /api/users/resolve-address?stake=stake1...
// Resolves a stake address to its associated payment address.
// Strategy (in order):
//   1. Return the payment_address stored in the users table (set at sign-in time)
//   2. Fall back to Blockfrost accountsAddresses lookup
//   3. Return a clear error if neither source has a payment address
export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stakeAddress = req.nextUrl.searchParams.get("stake");

  if (!stakeAddress) {
    return NextResponse.json({ error: "stake is required" }, { status: 400 });
  }

  // ── 1. Check DB cache first ──────────────────────────────────────────────
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("payment_address")
    .eq("stake_address", stakeAddress)
    .single();

  if (userRow?.payment_address) {
    return NextResponse.json({
      payment_address: userRow.payment_address,
      source: "db",
    });
  }

  // ── 2. Fall back to Blockfrost ───────────────────────────────────────────
  try {
    const addresses = await blockfrost.accountsAddresses(stakeAddress);

    if (!addresses || addresses.length === 0) {
      return NextResponse.json(
        { error: "No payment address found for this stake address" },
        { status: 404 },
      );
    }

    const paymentAddress = addresses[0].address;

    // Cache the resolved address for future payouts
    await supabaseAdmin
      .from("users")
      .update({ payment_address: paymentAddress })
      .eq("stake_address", stakeAddress);

    return NextResponse.json({
      payment_address: paymentAddress,
      all_addresses: addresses.map((a: { address: string }) => a.address),
      source: "blockfrost",
    });
  } catch (err) {
    const statusCode = (err as { status_code?: number })?.status_code;

    if (statusCode === 404) {
      return NextResponse.json(
        {
          error:
            "Payment address could not be resolved. The contributor's wallet has no on-chain activity yet. Ask them to reconnect their wallet to register their payment address.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to resolve payment address" },
      { status: 500 },
    );
  }
}
