-- Add payment_address column to users table.
-- This stores the contributor's base/payment address (addr1...) captured at
-- sign-in time, so payouts can be made even when the stake address has no
-- on-chain activity (which would cause Blockfrost lookups to fail).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS payment_address text;
