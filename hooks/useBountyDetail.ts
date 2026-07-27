"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/api";
import type { Bounty, Submission } from "@/types/bounty";

type UseBountyDetailReturn = {
  bounty: Bounty | null;
  isLoading: boolean;
  error: string;
  refetch: () => void;
  /** Appends a new submission to local state so the contributions list updates instantly. */
  addSubmission: (newSubmission: Submission) => void;
};

/**
 * Fetches a single bounty by ID, including its joined submissions and project metadata.
 * Extracted from BountyDetailsPage to separate data retrieval from component rendering.
 */
export function useBountyDetail(bountyId: string): UseBountyDetailReturn {
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchBounty = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch(`/api/bounties/${bountyId}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const data = (await response.json()) as Bounty | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Unable to load bounty.");
      }

      setBounty(data as Bounty);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load bounty.");
    } finally {
      setIsLoading(false);
    }
  }, [bountyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchBounty(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchBounty]);

  const addSubmission = useCallback((newSubmission: Submission) => {
    setBounty((prev) => {
      if (!prev) return prev;
      const existing = prev.submissions || [];
      return { ...prev, submissions: [newSubmission, ...existing] };
    });
  }, []);

  return { bounty, isLoading, error, refetch: fetchBounty, addSubmission };
}
