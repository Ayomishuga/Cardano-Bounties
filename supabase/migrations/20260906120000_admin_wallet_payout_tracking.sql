-- ============================================================
-- Admin Wallet Payout Tracking
-- ============================================================
-- Current payouts are intentionally sent from the admin payout wallet.
-- This migration adds explicit submitted/confirmed tracking so a wallet
-- submission does not have to be represented as a fully paid allocation.

ALTER TABLE public.bounty_payout_allocations
  ADD COLUMN IF NOT EXISTS payout_address text,
  ADD COLUMN IF NOT EXISTS payout_address_source text,
  ADD COLUMN IF NOT EXISTS payout_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_error text;

CREATE INDEX IF NOT EXISTS idx_allocations_processing_submitted_at
  ON public.bounty_payout_allocations (payout_submitted_at)
  WHERE status = 'processing';

-- ============================================================
-- RPC: submit_allocation_payment
-- Records a submitted admin-wallet transaction without marking the
-- allocation paid. A later verifier or admin confirmation should call
-- record_allocation_payment after the transaction is confirmed.
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_allocation_payment(
  p_allocation_id          uuid,
  p_tx_hash                text,
  p_admin_id               uuid,
  p_payout_address         text DEFAULT NULL,
  p_payout_address_source  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allocation    record;
  v_bounty_status text;
  v_finalized     boolean;
BEGIN
  IF p_tx_hash !~* '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'transaction_hash must be a 64 character hex transaction id');
  END IF;

  SELECT * INTO v_allocation
  FROM public.bounty_payout_allocations
  WHERE id = p_allocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Allocation not found');
  END IF;

  IF v_allocation.status NOT IN ('pending', 'failed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only pending or failed allocations can be submitted for payout');
  END IF;

  SELECT status, winners_finalized
  INTO v_bounty_status, v_finalized
  FROM public.bounties
  WHERE id = v_allocation.bounty_id;

  IF NOT v_finalized OR v_bounty_status NOT IN ('payout_pending', 'partially_paid') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Bounty winners must be finalized and bounty must be in payout_pending or partially_paid status'
    );
  END IF;

  UPDATE public.bounty_payout_allocations
  SET status                = 'processing',
      transaction_hash      = p_tx_hash,
      paid_by               = p_admin_id,
      payout_address        = COALESCE(NULLIF(p_payout_address, ''), payout_address),
      payout_address_source = COALESCE(NULLIF(p_payout_address_source, ''), payout_address_source),
      payout_submitted_at   = now(),
      payout_confirmed_at   = NULL,
      payout_error          = NULL,
      updated_at            = now()
  WHERE id = p_allocation_id;

  RETURN jsonb_build_object(
    'ok',              true,
    'status',          'processing',
    'bounty_status',   v_bounty_status,
    'contributor_id',  v_allocation.contributor_id,
    'bounty_id',       v_allocation.bounty_id,
    'amount_lovelace', v_allocation.amount_lovelace
  );
END;
$$;

-- ============================================================
-- RPC: record_allocation_payment
-- Confirms a payment. This intentionally accepts pending, failed, or
-- processing allocations so manual recovery can confirm a known-good tx.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_allocation_payment(
  p_allocation_id          uuid,
  p_tx_hash                text,
  p_admin_id               uuid,
  p_payout_address         text DEFAULT NULL,
  p_payout_address_source  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allocation    record;
  v_bounty_status text;
  v_finalized     boolean;
  v_pending_count integer;
  v_new_status    text;
BEGIN
  IF p_tx_hash !~* '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'transaction_hash must be a 64 character hex transaction id');
  END IF;

  SELECT * INTO v_allocation
  FROM public.bounty_payout_allocations
  WHERE id = p_allocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Allocation not found');
  END IF;

  IF v_allocation.status NOT IN ('pending', 'processing', 'failed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only unpaid allocations can be confirmed');
  END IF;

  SELECT status, winners_finalized
  INTO v_bounty_status, v_finalized
  FROM public.bounties
  WHERE id = v_allocation.bounty_id;

  IF NOT v_finalized OR v_bounty_status NOT IN ('payout_pending', 'partially_paid') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Bounty winners must be finalized and bounty must be in payout_pending or partially_paid status'
    );
  END IF;

  UPDATE public.bounty_payout_allocations
  SET status                = 'paid',
      transaction_hash      = p_tx_hash,
      paid_by               = p_admin_id,
      paid_at               = now(),
      payout_address        = COALESCE(NULLIF(p_payout_address, ''), payout_address),
      payout_address_source = COALESCE(NULLIF(p_payout_address_source, ''), payout_address_source),
      payout_submitted_at   = COALESCE(payout_submitted_at, now()),
      payout_confirmed_at   = now(),
      payout_error          = NULL,
      updated_at            = now()
  WHERE id = p_allocation_id;

  UPDATE public.submissions
  SET status           = 'paid',
      paid_at          = now(),
      transaction_hash = p_tx_hash,
      updated_at       = now()
  WHERE id = v_allocation.submission_id;

  SELECT COUNT(*) INTO v_pending_count
  FROM public.bounty_payout_allocations
  WHERE bounty_id = v_allocation.bounty_id
    AND status NOT IN ('paid', 'cancelled');

  v_new_status := CASE WHEN v_pending_count = 0 THEN 'completed' ELSE 'partially_paid' END;

  UPDATE public.bounties
  SET status         = v_new_status,
      payout_tx_hash = p_tx_hash,
      updated_at     = now()
  WHERE id = v_allocation.bounty_id;

  RETURN jsonb_build_object(
    'ok',              true,
    'status',          'paid',
    'bounty_status',   v_new_status,
    'contributor_id',  v_allocation.contributor_id,
    'bounty_id',       v_allocation.bounty_id,
    'amount_lovelace', v_allocation.amount_lovelace
  );
END;
$$;
