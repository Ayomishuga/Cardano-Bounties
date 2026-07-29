"use client";

import { useCallback, useEffect, useState } from "react";
import type { Bounty, BountyListResponse, BountyPagination } from "@/types/bounty";

const PAGE_SIZE = 9;

type UseBountyListParams = {
  type: string;
  query: string;
  page: number;
};

type UseBountyListReturn = {
  bounties: Bounty[];
  pagination: BountyPagination;
  isLoading: boolean;
  error: string;
  refetch: () => void;
};

const DEFAULT_PAGINATION: BountyPagination = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

/**
 * Fetches a paginated, filterable list of public bounties.
 *
 * Handles the request lifecycle (loading, error, data) so that
 * ExploreBountiesPage only needs to manage filter UI state.
 */
export function useBountyList({ type, query, page }: UseBountyListParams): UseBountyListReturn {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [pagination, setPagination] = useState<BountyPagination>(DEFAULT_PAGINATION);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchBounties = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      if (query.trim()) params.set("search", query.trim());
      if (type !== "all") params.set("type", type);

      const response = await fetch(`/api/bounties?${params.toString()}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const payload = (await response.json()) as BountyListResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load bounties right now.");
      }

      setBounties(Array.isArray(payload.data) ? payload.data : []);
      setPagination(payload.pagination ?? { ...DEFAULT_PAGINATION, page });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load bounties right now.");
    } finally {
      setIsLoading(false);
    }
  }, [type, query, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchBounties();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchBounties]);

  return { bounties, pagination, isLoading, error, refetch: fetchBounties };
}
