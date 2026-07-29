"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/api";
import { getSubmitterHandle, getSubmissionBounty } from "@/lib/bountyHelpers";
import type { Submission } from "@/types/bounty";

type SubmissionsApiResponse = {
  data?: Submission[];
  error?: string;
};

type SortColumn = "submitter" | "amount" | "status" | "submitted";

type UseSubmissionsDataReturn = {
  items: Submission[];
  rawSubmissions: Submission[];
  isLoading: boolean;
  error: string;
  refetch: () => void;
  // Filter & sort state
  filter: string;
  setFilter: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  sortCol: SortColumn;
  sortDesc: boolean;
  handleSort: (col: SortColumn) => void;
  // Optimistic update helper
  updateSubmissionStatus: (id: string, status: string, feedback: string) => void;
};

/**
 * Manages all data and filter/sort state for the admin submissions table.
 *
 * Extracted from AdminSubmissionsPage so the component only handles rendering.
 * Includes an optimistic update helper so the table reflects changes immediately
 * after approve/reject without requiring a full refetch.
 */
export function useSubmissionsData(): UseSubmissionsDataReturn {
  const [data, setData] = useState<SubmissionsApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortColumn>("submitted");
  const [sortDesc, setSortDesc] = useState(true);

  const fetchSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      // Use the dedicated submissions API so we get ALL statuses (pending, approved, rejected),
      // not just the pending queue from the dashboard endpoint.
      const response = await authFetch("/api/admin/submissions", {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as SubmissionsApiResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load submissions.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load submissions.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchSubmissions(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchSubmissions]);

  const handleSort = useCallback(
    (col: SortColumn) => {
      if (sortCol === col) {
        setSortDesc((d) => !d);
      } else {
        setSortCol(col);
        setSortDesc(true);
      }
    },
    [sortCol],
  );

  const items = useMemo(() => {
    let list = data?.data ?? [];

    if (filter !== "all") {
      list = list.filter((s) => s.status.toLowerCase() === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => {
        const handle = getSubmitterHandle(s).toLowerCase();
        const title = getSubmissionBounty(s)?.title.toLowerCase() ?? "";
        return handle.includes(q) || title.includes(q);
      });
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "submitter": {
          cmp = getSubmitterHandle(a).localeCompare(getSubmitterHandle(b));
          break;
        }
        case "amount": {
          cmp =
            Number(getSubmissionBounty(a)?.reward_amount ?? 0) -
            Number(getSubmissionBounty(b)?.reward_amount ?? 0);
          break;
        }
        case "status": {
          cmp = a.status.localeCompare(b.status);
          break;
        }
        case "submitted": {
          const aDate = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
          const bDate = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
          cmp = aDate - bDate;
          break;
        }
      }
      return sortDesc ? -cmp : cmp;
    });

    return list;
  }, [data, filter, search, sortCol, sortDesc]);

  /** Optimistically updates a submission's status in local state after approve/reject. */
  const updateSubmissionStatus = useCallback(
    (id: string, status: string, feedback: string) => {
      setData((prev) => {
        if (!prev) return prev;
        const updated = prev.data?.map((s) =>
          s.id === id ? { ...s, status, feedback } : s,
        );
        return { ...prev, data: updated };
      });
    },
    [],
  );

  return {
    items,
    rawSubmissions: data?.data ?? [],
    isLoading,
    error,
    refetch: fetchSubmissions,
    filter,
    setFilter,
    search,
    setSearch,
    sortCol,
    sortDesc,
    handleSort,
    updateSubmissionStatus,
  };
}
