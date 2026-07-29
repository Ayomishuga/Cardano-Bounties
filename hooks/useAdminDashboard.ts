"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/api";
import type { Bounty, Submission, AdminDashboardResponse } from "@/types/bounty";

/** 2-minute auto-refresh interval for live admin queue data. */
const REFRESH_INTERVAL_MS = 120_000;

type UseAdminDashboardReturn = {
  metrics: Record<string, number>;
  bountyReviews: Bounty[];
  pendingSubmissions: Submission[];
  allBounties: Bounty[];
  isLoading: boolean;
  error: string;
  refetch: () => void;
};

/**
 * Fetches and auto-refreshes all admin dashboard data from /api/dashboard/admin.
 *
 * Separates data-fetching concerns from DashboardPage rendering so that
 * the component can focus on layout and user interactions.
 */
export function useAdminDashboard(isAuthenticated: boolean): UseAdminDashboardReturn {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/dashboard/admin", {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as AdminDashboardResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load dashboard.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Initial load + 2-minute polling interval.
  useEffect(() => {
    const initialTimer = window.setTimeout(() => void fetchDashboard(), 0);

    if (!isAuthenticated) {
      return () => window.clearTimeout(initialTimer);
    }

    const interval = window.setInterval(() => void fetchDashboard(), REFRESH_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [isAuthenticated, fetchDashboard]);

  return {
    metrics: data?.metrics ?? {},
    bountyReviews: data?.queues.bounty_reviews ?? [],
    pendingSubmissions: data?.queues.pending_submissions ?? [],
    allBounties: data?.queues.bounties ?? [],
    isLoading,
    error,
    refetch: fetchDashboard,
  };
}
