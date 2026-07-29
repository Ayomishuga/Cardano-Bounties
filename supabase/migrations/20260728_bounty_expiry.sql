-- ============================================================
-- Bounty Expiry Lifecycle
-- Adds deadline_extended_count to track poster self-extensions.
-- Max 2 extensions enforced by both API and DB constraint.
-- ============================================================

ALTER TABLE public.bounties
  ADD COLUMN IF NOT EXISTS deadline_extended_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.bounties
  DROP CONSTRAINT IF EXISTS bounties_max_extensions_check;
ALTER TABLE public.bounties
  ADD CONSTRAINT bounties_max_extensions_check
  CHECK (deadline_extended_count <= 2) NOT VALID;
