alter table if exists bounties
  add column if not exists escrow_last_checked_at timestamptz,
  add column if not exists escrow_verification_attempts integer not null default 0,
  add column if not exists escrow_verification_error text;

create index if not exists idx_bounties_pending_escrow_retry
  on bounties (status, escrow_submitted_at)
  where status = 'pending_escrow' and escrow_tx_hash is not null and escrow_confirmed_at is null;
