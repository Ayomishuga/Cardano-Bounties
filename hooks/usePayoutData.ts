"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/api";
import type { Bounty, PayoutAllocation } from "@/types/bounty";

type AllocationsCache = Record<string, PayoutAllocation[]>;

type UsePayoutDataReturn = {
  bounties: Bounty[];
  isLoading: boolean;
  error: string;
  refetch: () => void;
  /** Loads allocations for a specific bounty. Results are cached to avoid re-fetching on expand/collapse. */
  loadAllocations: (bountyId: string) => Promise<PayoutAllocation[]>;
  allocationsCache: AllocationsCache;
  setAllocationsCache: React.Dispatch<React.SetStateAction<AllocationsCache>>;
};

/**
 * Fetches the list of bounties relevant to the payouts workspace,
 * and provides a lazy-load mechanism for per-bounty allocations.
 *
 * Allocation results are cached by bountyId so that expanding/collapsing
 * a bounty row does not trigger repeat network requests.
 */
export function usePayoutData(): UsePayoutDataReturn {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [allocationsCache, setAllocationsCache] = useState<AllocationsCache>({});

  const fetchBounties = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/admin/bounties", {
        headers: { Accept: "application/json" },
      });
      // The admin bounties API returns either a plain array or { data: Bounty[] }.
      // Handle both shapes so the hook is resilient to either format.
      const raw = await response.json() as Bounty[] | { data?: Bounty[]; error?: string };

      if (!response.ok) {
        const err = Array.isArray(raw) ? "Unable to load payout data." : ((raw as { error?: string }).error || "Unable to load payout data.");
        throw new Error(err);
      }

      const bountyList = Array.isArray(raw) ? raw : ((raw as { data?: Bounty[] }).data ?? []);
      setBounties(bountyList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payout data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchBounties(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchBounties]);

  const loadAllocations = useCallback(
    async (bountyId: string): Promise<PayoutAllocation[]> => {
      // Return cached result if available.
      if (allocationsCache[bountyId]) return allocationsCache[bountyId];

      try {
        const response = await authFetch(
          `/api/admin/allocations?bounty_id=${bountyId}`,
          { headers: { Accept: "application/json" } },
        );
        const payload = await response.json() as { data?: PayoutAllocation[]; error?: string };

        if (!response.ok) throw new Error(payload.error || "Failed to load allocations.");

        const allocations = payload.data ?? [];
        setAllocationsCache((prev) => ({ ...prev, [bountyId]: allocations }));
        return allocations;
      } catch {
        return [];
      }
    },
    [allocationsCache],
  );

  return {
    bounties,
    isLoading,
    error,
    refetch: fetchBounties,
    loadAllocations,
    allocationsCache,
    setAllocationsCache,
  };
}
