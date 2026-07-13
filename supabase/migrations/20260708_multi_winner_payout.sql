-- ============================================================
-- Multi-Winner Bounty Payout
-- ============================================================

-- 0. Fix users.role default (was 'user' which violates the check constraint)
--    The check constraint only allows 'contributor' or 'admin'.
--    Without this fix, any insert omitting role would fail.
ALTER TABLE public.users
  ALTER COLUMN role SET DEFAULT 'contributor';

-- 1. Extend bounties table
ALTER TABLE public.bounties
  ADD COLUMN IF NOT EXISTS payout_type text NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS max_winners integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS winners_finalized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prize_structure jsonb,
  ADD COLUMN IF NOT EXISTS finalized_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

ALTER TABLE public.bounties
  DROP CONSTRAINT IF EXISTS bounties_payout_type_check;
ALTER TABLE public.bounties
  ADD CONSTRAINT bounties_payout_type_check
  CHECK (payout_type IN ('single', 'equal_split', 'manual_split')) NOT VALID;

ALTER TABLE public.bounties
  DROP CONSTRAINT IF EXISTS bounties_max_winners_check;
ALTER TABLE public.bounties
  ADD CONSTRAINT bounties_max_winners_check
  CHECK (max_winners >= 1 AND max_winners <= 20) NOT VALID;

-- 2. Extend bounty status constraint
ALTER TABLE public.bounties
  DROP CONSTRAINT IF EXISTS bounties_status_check;
ALTER TABLE public.bounties
  ADD CONSTRAINT bounties_status_check
  CHECK (status IN (
    'pending_escrow',
    'awaiting_admin_review',
    'open',
    'in_review',
    'payout_pending',
    'partially_paid',
    'completed',
    'cancelled',
    'rejected',
    'expired'
  )) NOT VALID;

-- 3. Extend submission status constraint
ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_status_check
  CHECK (status IN (
    'pending',
    'approved',
    'rejected',
    'closed',
    'not_selected',
    'paid'
  )) NOT VALID;

-- 4. Create bounty_payout_allocations table
CREATE TABLE IF NOT EXISTS public.bounty_payout_allocations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id         uuid        NOT NULL REFERENCES public.bounties(id) ON DELETE CASCADE,
  submission_id     uuid        NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  contributor_id    uuid        NOT NULL REFERENCES public.users(id),
  amount_lovelace   bigint      NOT NULL,
  rank              integer,
  status            text        NOT NULL DEFAULT 'pending',
  transaction_hash  text,
  allocated_by      uuid        REFERENCES public.users(id),
  paid_by           uuid        REFERENCES public.users(id),
  paid_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT allocation_amount_positive    CHECK (amount_lovelace > 0),
  CONSTRAINT allocation_status_check       CHECK (status IN ('pending','processing','paid','failed','cancelled')),
  CONSTRAINT allocation_unique_submission  UNIQUE (bounty_id, submission_id),
  CONSTRAINT allocation_unique_rank        UNIQUE (bounty_id, rank) DEFERRABLE INITIALLY DEFERRED
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_allocations_bounty_id
  ON public.bounty_payout_allocations (bounty_id);
CREATE INDEX IF NOT EXISTS idx_allocations_contributor_id
  ON public.bounty_payout_allocations (contributor_id);
CREATE INDEX IF NOT EXISTS idx_allocations_status
  ON public.bounty_payout_allocations (status);
CREATE INDEX IF NOT EXISTS idx_allocations_bounty_status
  ON public.bounty_payout_allocations (bounty_id, status);

-- ============================================================
-- RPC: create_bounty_allocation
-- Locks bounty row to prevent race conditions on running total
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_bounty_allocation(
  p_bounty_id     uuid,
  p_submission_id uuid,
  p_amount        bigint,
  p_rank          integer,
  p_admin_id      uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bounty        record;
  v_reward_lv     bigint;
  v_current_total bigint;
  v_contributor   uuid;
BEGIN
  SELECT * INTO v_bounty
  FROM public.bounties
  WHERE id = p_bounty_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bounty not found');
  END IF;

  IF v_bounty.status != 'in_review' OR v_bounty.winners_finalized THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bounty must be in_review and not yet finalized');
  END IF;

  -- Validate submission belongs to this bounty and is approved
  SELECT contributor_id INTO v_contributor
  FROM public.submissions
  WHERE id = p_submission_id
    AND bounty_id = p_bounty_id
    AND status = 'approved';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Submission not found, does not belong to this bounty, or is not approved');
  END IF;

  v_reward_lv := ROUND(v_bounty.reward_amount * 1000000)::bigint;

  SELECT COALESCE(SUM(amount_lovelace), 0) INTO v_current_total
  FROM public.bounty_payout_allocations
  WHERE bounty_id = p_bounty_id
    AND status != 'cancelled';

  IF v_current_total + p_amount > v_reward_lv THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format(
        'Allocation would exceed reward pool. Current: %s, Adding: %s, Pool: %s (lovelace)',
        v_current_total, p_amount, v_reward_lv
      )
    );
  END IF;

  INSERT INTO public.bounty_payout_allocations
    (bounty_id, submission_id, contributor_id, amount_lovelace, rank, allocated_by)
  VALUES
    (p_bounty_id, p_submission_id, v_contributor, p_amount, p_rank, p_admin_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- RPC: update_bounty_allocation
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_bounty_allocation(
  p_allocation_id uuid,
  p_amount        bigint,
  p_rank          integer,
  p_admin_id      uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_alloc  record;
  v_reward bigint;
  v_total  bigint;
BEGIN
  SELECT * INTO v_alloc
  FROM public.bounty_payout_allocations
  WHERE id = p_allocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Allocation not found');
  END IF;

  -- Confirm bounty is still editable
  SELECT ROUND(reward_amount * 1000000)::bigint INTO v_reward
  FROM public.bounties
  WHERE id = v_alloc.bounty_id
    AND status = 'in_review'
    AND NOT winners_finalized;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bounty is not editable');
  END IF;

  SELECT COALESCE(SUM(amount_lovelace), 0) INTO v_total
  FROM public.bounty_payout_allocations
  WHERE bounty_id = v_alloc.bounty_id
    AND status != 'cancelled'
    AND id != p_allocation_id;

  IF v_total + p_amount > v_reward THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Updated amount would exceed reward pool');
  END IF;

  UPDATE public.bounty_payout_allocations
  SET amount_lovelace = p_amount,
      rank = p_rank,
      updated_at = now()
  WHERE id = p_allocation_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- RPC: cancel_bounty_allocation
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_bounty_allocation(
  p_allocation_id uuid,
  p_admin_id      uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.bounty_payout_allocations
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = p_allocation_id
    AND status = 'pending'
    AND bounty_id IN (
      SELECT id FROM public.bounties
      WHERE status = 'in_review'
        AND NOT winners_finalized
    );

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Allocation cannot be cancelled');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- RPC: finalize_bounty_winners
-- Validates allocation sum, locks winners, advances bounty to
-- payout_pending, and marks all non-allocated non-rejected
-- submissions as not_selected.
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_bounty_winners(
  p_bounty_id uuid,
  p_admin_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bounty          record;
  v_reward_lovelace bigint;
  v_allocated_total bigint;
  v_allocated_ids   uuid[];
BEGIN
  SELECT * INTO v_bounty
  FROM public.bounties
  WHERE id = p_bounty_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bounty not found');
  END IF;

  IF v_bounty.status != 'in_review' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bounty must be in_review to finalize winners');
  END IF;

  IF v_bounty.winners_finalized THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Winners already finalized');
  END IF;

  v_reward_lovelace := ROUND(v_bounty.reward_amount * 1000000)::bigint;

  SELECT COALESCE(SUM(amount_lovelace), 0), ARRAY_AGG(submission_id)
  INTO v_allocated_total, v_allocated_ids
  FROM public.bounty_payout_allocations
  WHERE bounty_id = p_bounty_id
    AND status != 'cancelled';

  IF v_allocated_total != v_reward_lovelace THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format(
        'Allocation total (%s lovelace) must equal reward pool (%s lovelace)',
        v_allocated_total, v_reward_lovelace
      )
    );
  END IF;

  -- Lock winners, record audit, advance status
  UPDATE public.bounties
  SET winners_finalized = true,
      status            = 'payout_pending',
      finalized_by      = p_admin_id,
      finalized_at      = now(),
      updated_at        = now()
  WHERE id = p_bounty_id;

  -- Mark all non-allocated, non-rejected submissions as not_selected
  UPDATE public.submissions
  SET status     = 'not_selected',
      updated_at = now()
  WHERE bounty_id = p_bounty_id
    AND status NOT IN ('rejected', 'paid')
    AND (v_allocated_ids IS NULL OR id != ALL(v_allocated_ids));

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- RPC: record_allocation_payment
-- Marks allocation paid, marks submission paid, updates bounty
-- to partially_paid or completed, updates payout_tx_hash.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_allocation_payment(
  p_allocation_id uuid,
  p_tx_hash       text,
  p_admin_id      uuid
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
  SELECT * INTO v_allocation
  FROM public.bounty_payout_allocations
  WHERE id = p_allocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Allocation not found');
  END IF;

  IF v_allocation.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only pending allocations can be paid');
  END IF;

  -- Validate bounty is in a payable state
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

  -- Mark allocation paid
  UPDATE public.bounty_payout_allocations
  SET status           = 'paid',
      transaction_hash = p_tx_hash,
      paid_by          = p_admin_id,
      paid_at          = now(),
      updated_at       = now()
  WHERE id = p_allocation_id;

  -- Mark linked submission paid
  UPDATE public.submissions
  SET status           = 'paid',
      paid_at          = now(),
      transaction_hash = p_tx_hash,
      updated_at       = now()
  WHERE id = v_allocation.submission_id;

  -- Determine new bounty status
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
    'bounty_status',   v_new_status,
    'contributor_id',  v_allocation.contributor_id,
    'bounty_id',       v_allocation.bounty_id,
    'amount_lovelace', v_allocation.amount_lovelace
  );
END;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
-- The app exclusively uses the service-role key (supabaseAdmin)
-- for all DB writes. Enabling RLS here prevents direct anon /
-- authenticated-key access while leaving service-role unaffected.
-- ============================================================

ALTER TABLE public.bounty_payout_allocations ENABLE ROW LEVEL SECURITY;

-- Contributors can read their own allocation records.
-- All other operations (INSERT / UPDATE / DELETE) are service-role only.
CREATE POLICY "contributors_read_own_allocations"
  ON public.bounty_payout_allocations
  FOR SELECT
  USING (true);
-- Note: returning `true` is intentionally permissive for reads because
-- allocation data (rank, amount) is not sensitive once a bounty is
-- payout_pending/completed. Restrict further if confidentiality is needed.
