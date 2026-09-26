"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import { getSubmissionBounty, getRankPlacementLabel } from "@/lib/bountyHelpers";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useItemNavigation } from "@/hooks/useItemNavigation";
import type { DashboardResponse, SubmissionSortColumn } from "./types";
import { getSubmitterHandle } from "./types";

export function useAdminSubmissionsWorkspace() {
  const toast = useToast();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [sortCol, setSortCol] = useState<SubmissionSortColumn>("submitted");
  const [sortDesc, setSortDesc] = useState(true);

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [contextOpen, setContextOpen] = useState(true);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/dashboard/admin", { headers: { Accept: "application/json" } });
      const payload = (await response.json()) as DashboardResponse;

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
    const timeoutId = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDashboard]);

  const items = useMemo(() => {
    let list = data?.queues.pending_submissions || [];

    if (filter !== "all") {
      list = list.filter((s) => s.status.toLowerCase() === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => {
        const handle = getSubmitterHandle(s).toLowerCase();
        const bountyTitle = getSubmissionBounty(s)?.title.toLowerCase() || "";
        return handle.includes(q) || bountyTitle.includes(q);
      });
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "submitter":
          cmp = getSubmitterHandle(a).localeCompare(getSubmitterHandle(b));
          break;
        case "amount":
          const aAmount = Number(getSubmissionBounty(a)?.reward_amount || 0);
          const bAmount = Number(getSubmissionBounty(b)?.reward_amount || 0);
          cmp = aAmount - bAmount;
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "submitted":
          const aDate = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
          const bDate = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
          cmp = aDate - bDate;
          break;
      }
      return sortDesc ? -cmp : cmp;
    });

    return list;
  }, [data, filter, search, sortCol, sortDesc]);

  const { selectedItem, canGoPrev, canGoNext, goToPrev, goToNext } = useItemNavigation(
    items,
    selectedSubmissionId,
    (id) => {
      setSelectedSubmissionId(id);
      setContextOpen(true);
    }
  );
  const selectedBounty = selectedItem ? getSubmissionBounty(selectedItem) : null;
  const [bountyAllocations, setBountyAllocations] = useState<any[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);

  useEffect(() => {
    if (!selectedBounty?.id) {
      setBountyAllocations([]);
      return;
    }
    let cancelled = false;
    setLoadingAllocations(true);
    authFetch(`/api/admin/allocations?bounty_id=${selectedBounty.id}`)
      .then(async (res) => {
        if (!res.ok) return [];
        return (await res.json()) || [];
      })
      .then((allocs) => {
        if (!cancelled) setBountyAllocations(allocs);
      })
      .catch(() => {
        if (!cancelled) setBountyAllocations([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAllocations(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBounty?.id]);

  useEffect(() => {
    if (selectedItem) {
      const timeoutId = window.setTimeout(() => {
        setAdminNote(selectedItem.feedback || "");
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [selectedItem]);

  const handleSort = (col: SubmissionSortColumn) => {
    if (sortCol === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(col);
      setSortDesc(true);
    }
  };

  const runAction = async (
    status: "approved" | "rejected",
    rank?: number | null,
    amountLovelace?: number | null,
  ) => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      const response = await authFetch(`/api/submissions/${selectedItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          feedback: adminNote,
          rank: status === "approved" ? rank : undefined,
          amount_lovelace: status === "approved" ? amountLovelace : undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Action failed.");

      toast.success(
        status === "approved" ? "Submission Approved" : "Submission Rejected",
        status === "approved" && rank
          ? `Awarded ${getRankPlacementLabel(rank)} and locked in for payout.`
          : `Submission marked as ${status}.`
      );

      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        const updatedQueue = prev.queues.pending_submissions?.map((sub) =>
          sub.id === selectedItem.id ? { ...sub, status, feedback: adminNote } : sub
        );
        return { ...prev, queues: { ...prev.queues, pending_submissions: updatedQueue } };
      });

      handleCloseModal();
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : "Unable to complete action.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRowClick = (id: string) => {
    setSelectedSubmissionId(id);
    setContextOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedSubmissionId(null);
  };

  useEscapeKey(handleCloseModal, Boolean(selectedSubmissionId));

  return {
    isLoading,
    error,
    loadDashboard,
    filter,
    setFilter,
    search,
    setSearch,
    sortCol,
    sortDesc,
    handleSort,
    items,
    selectedItem,
    selectedBounty,
    canGoPrev,
    canGoNext,
    goToPrev,
    goToNext,
    selectedSubmissionId,
    setSelectedSubmissionId,
    handleRowClick,
    handleCloseModal,
    adminNote,
    setAdminNote,
    contextOpen,
    setContextOpen,
    isSubmitting,
    runAction,
    bountyAllocations,
    loadingAllocations,
  };
}
