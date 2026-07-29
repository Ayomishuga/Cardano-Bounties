"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/api";
import type { Bounty, Submission, PosterDashboardResponse } from "@/types/bounty";

type UsePosterDashboardReturn = {
  metrics: Record<string, number>;
  bounties: Bounty[];
  pendingSubmissionReviews: Submission[];
  isLoading: boolean;
  error: string;
  refetch: () => void;
};

/**
 * Fetches poster dashboard data from /api/dashboard/poster.
 *
 * Separates data-fetching from DashboardPage rendering for the poster role view.
 */
export function usePosterDashboard(isAuthenticated: boolean): UsePosterDashboardReturn {
  const [data, setData] = useState<PosterDashboardResponse | null>(null);
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
      const response = await authFetch("/api/dashboard/poster", {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as PosterDashboardResponse;

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

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchDashboard]);

  return {
    metrics: data?.metrics ?? {},
    bounties: data?.queues.bounties ?? [],
    pendingSubmissionReviews: data?.queues.pending_submission_reviews ?? [],
    isLoading,
    error,
    refetch: fetchDashboard,
  };
}
