import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import { releaseBountyPayout } from "@/lib/cardano/transactions/bountyEscrow";
import { useAppWallet } from "@/components/wallet/WalletProvider";
import { shortId } from "@/lib/formatters";
import { LOVELACE_PER_ADA } from "@/lib/bountyContract";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import type {
  Allocation,
  AllocationDraft,
  AllocationStatus,
  Bounty,
  BountySubmission,
  DashboardResponse,
} from "./types";
import { rewardToLovelace } from "./types";

export function usePayoutsWorkspace() {
  const toast = useToast();
  const { wallet, address } = useAppWallet();

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "needs_allocation" | "ready_to_pay" | "partially_paid" | "completed">("all");
  const [sortCol, setSortCol] = useState<"title" | "status">("status");
  const [sortDesc, setSortDesc] = useState(true);
  const [reviewingBountyId, setReviewingBountyId] = useState<string | null>(null);
  const [allocationDrafts, setAllocationDrafts] = useState<Record<string, AllocationDraft>>({});
  const [allocatingSubmissionId, setAllocatingSubmissionId] = useState<string | null>(null);
  const [finalizingBountyId, setFinalizingBountyId] = useState<string | null>(null);
  const [cancellingAllocationId, setCancellingAllocationId] = useState<string | null>(null);
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<AllocationDraft>({});

  // Allocation release modal state
  const [selectedAlloc, setSelectedAlloc] = useState<Allocation | null>(null);
  const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);
  const [txHash, setTxHash] = useState("");
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedSource, setResolvedSource] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExecutingOnChain, setIsExecutingOnChain] = useState(false);

  // Bounty expand/collapse
  const [expandedBountyIds, setExpandedBountyIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const dashRes = await authFetch("/api/dashboard/admin", { headers: { Accept: "application/json" } });
      const dash = (await dashRes.json()) as DashboardResponse;
      if (!dashRes.ok) throw new Error(dash.error || "Unable to load dashboard.");
      setData(dash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payouts.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load allocations separately per bounty when expanded
  const loadAllocations = useCallback(async (bountyId: string) => {
    const res = await authFetch(`/api/admin/allocations?bounty_id=${bountyId}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    return (await res.json()) as Allocation[];
  }, []);

  const toggleExpand = useCallback(
    async (bounty: Bounty) => {
      const next = new Set(expandedBountyIds);
      if (next.has(bounty.id)) {
        next.delete(bounty.id);
        setExpandedBountyIds(next);
        return;
      }
      next.add(bounty.id);
      setExpandedBountyIds(next);
      // Load allocations if not yet loaded
      if (!bounty.allocations) {
        const allocs = await loadAllocations(bounty.id);
        setData((prev) => {
          if (!prev) return prev;
          const updateBountyList = (list: Bounty[] | undefined) => (list ?? []).map((b) =>
            b.id === bounty.id ? { ...b, allocations: allocs } : b,
          );
          return {
            ...prev,
            queues: {
              ...prev.queues,
              bounties: updateBountyList(prev.queues.bounties),
              in_review_bounties: updateBountyList(prev.queues.in_review_bounties),
            },
          };
        });
      }
    },
    [expandedBountyIds, loadAllocations],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  // Bounties eligible for payout management
  const payoutBounties = useMemo(() => {
    const bountiesById = new Map<string, Bounty>();
    for (const bounty of data?.queues.bounties ?? []) bountiesById.set(bounty.id, bounty);
    for (const bounty of data?.queues.in_review_bounties ?? []) {
      bountiesById.set(bounty.id, { ...bountiesById.get(bounty.id), ...bounty });
    }

    const PAYOUT_STATUSES = ["in_review", "payout_pending", "partially_paid", "completed"];
    let list = [...bountiesById.values()].filter((b) => {
      const hasApprovedSubmission = (b.submissions ?? []).some((submission) => submission.status === "approved");
      return PAYOUT_STATUSES.includes(b.status) || (b.status === "open" && hasApprovedSubmission);
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) => b.title.toLowerCase().includes(q));
    }

    if (filter === "needs_allocation") {
      list = list.filter((b) => {
        if (b.winners_finalized) return false;
        if (b.status === "in_review") return true;
        if (b.status === "open") {
          return (b.submissions ?? []).some((sub) => sub.status === "approved");
        }
        return false;
      });
    }
    if (filter === "ready_to_pay")     list = list.filter((b) => b.status === "payout_pending");
    if (filter === "partially_paid")   list = list.filter((b) => b.status === "partially_paid");
    if (filter === "completed")        list = list.filter((b) => b.status === "completed");

    return list;
  }, [data, search, filter]);

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(col);
      setSortDesc(true);
    }
  };

  const startReview = async (bounty: Bounty) => {
    setReviewingBountyId(bounty.id);
    try {
      const res = await authFetch(`/api/admin/bounties/${bounty.id}/start-review`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Unable to start review.");

      toast.success("Review started", "The bounty is now ready for winner allocation.");
      setData((prev) => {
        if (!prev) return prev;

        const updateBountyList = (list: Bounty[] | undefined) =>
          (list ?? []).map((item) => item.id === bounty.id ? { ...item, status: "in_review" } : item);
        const updatedInReviewBounties = updateBountyList(prev.queues.in_review_bounties);
        const hasInReviewCopy = updatedInReviewBounties.some((item) => item.id === bounty.id);

        return {
          ...prev,
          queues: {
            ...prev.queues,
            bounties: updateBountyList(prev.queues.bounties),
            in_review_bounties: hasInReviewCopy
              ? updatedInReviewBounties
              : [...updatedInReviewBounties, { ...bounty, status: "in_review" }],
          },
        };
      });
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : "Unable to start review.");
    } finally {
      setReviewingBountyId(null);
    }
  };

  const updateBountyAllocations = (bountyId: string, allocations: Allocation[], status?: string, winnersFinalized?: boolean) => {
    setData((prev) => {
      if (!prev) return prev;
      const updateBountyList = (list: Bounty[] | undefined) =>
        (list ?? []).map((item) =>
          item.id === bountyId
            ? {
                ...item,
                allocations,
                status: status ?? item.status,
                winners_finalized: winnersFinalized ?? item.winners_finalized,
              }
            : item,
        );

      return {
        ...prev,
        queues: {
          ...prev.queues,
          bounties: updateBountyList(prev.queues.bounties),
          in_review_bounties: updateBountyList(prev.queues.in_review_bounties),
        },
      };
    });
  };

  const getAllocationDefaults = (bounty: Bounty, unallocatedIndex: number) => {
    const activeAllocations = (bounty.allocations ?? []).filter((allocation) => allocation.status !== "cancelled");
    const usedRanks = new Set(activeAllocations.map((allocation) => allocation.rank).filter((rank): rank is number => Boolean(rank)));
    const sortedPrizes = [...(bounty.prize_structure ?? [])].sort((a, b) => a.rank - b.rank);
    const nextPrize = sortedPrizes.find((prize) => !usedRanks.has(prize.rank)) ?? sortedPrizes[unallocatedIndex];
    const maxWinners = Math.max(1, Number(bounty.max_winners || 1));
    const rewardLovelace = rewardToLovelace(bounty.reward_amount);

    if (bounty.payout_type === "manual_split" && nextPrize) {
      return {
        amountLovelace: nextPrize.amount_lovelace,
        rank: nextPrize.rank,
      };
    }

    if (bounty.payout_type === "equal_split") {
      const base = Math.floor(rewardLovelace / maxWinners);
      const remainder = rewardLovelace % maxWinners;
      return {
        amountLovelace: unallocatedIndex === 0 ? base + remainder : base,
        rank: unallocatedIndex + 1,
      };
    }

    return {
      amountLovelace: rewardLovelace,
      rank: null,
    };
  };

  const getDraftKey = (bountyId: string, submissionId: string) => `${bountyId}:${submissionId}`;

  const createAllocation = async (
    bounty: Bounty,
    submission: BountySubmission,
    defaults: { amountLovelace: number; rank: number | null },
  ) => {
    const draft = allocationDrafts[getDraftKey(bounty.id, submission.id)] ?? {};
    const amountAda = draft.amountAda?.trim() || String(defaults.amountLovelace / LOVELACE_PER_ADA);
    const amountLovelace = rewardToLovelace(amountAda);
    const rankText = draft.rank?.trim();
    const rank = rankText ? Number(rankText) : defaults.rank;

    if (!Number.isInteger(amountLovelace) || amountLovelace <= 0) {
      toast.error("Invalid amount", "Enter a positive ADA amount for this allocation.");
      return;
    }

    if (rank !== null && (!Number.isInteger(rank) || rank < 1)) {
      toast.error("Invalid rank", "Rank must be a positive whole number.");
      return;
    }

    setAllocatingSubmissionId(submission.id);
    try {
      const res = await authFetch("/api/admin/allocations", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: JSON.stringify({
          bounty_id: bounty.id,
          submission_id: submission.id,
          amount_lovelace: amountLovelace,
          rank,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Unable to create allocation.");

      const allocations = await loadAllocations(bounty.id);
      updateBountyAllocations(bounty.id, allocations);
      toast.success("Allocation created", "The approved submission is now queued for payout allocation.");
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : "Unable to create allocation.");
    } finally {
      setAllocatingSubmissionId(null);
    }
  };

  const finalizeWinners = async (bounty: Bounty) => {
    setFinalizingBountyId(bounty.id);
    try {
      const res = await authFetch(`/api/admin/bounties/${bounty.id}/finalize-winners`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Unable to finalize winners.");

      const allocations = await loadAllocations(bounty.id);
      updateBountyAllocations(bounty.id, allocations, "payout_pending", true);
      toast.success("Winners finalized", "This bounty is now ready for payout.");
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : "Unable to finalize winners.");
    } finally {
      setFinalizingBountyId(null);
    }
  };

  const cancelAllocation = async (alloc: Allocation, bounty: Bounty) => {
    setCancellingAllocationId(alloc.id);
    try {
      const res = await authFetch(`/api/admin/allocations/${alloc.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Unable to cancel allocation.");
      const allocations = await loadAllocations(bounty.id);
      updateBountyAllocations(bounty.id, allocations);
      toast.success("Allocation cancelled", "The allocation has been removed.");
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : "Unable to cancel allocation.");
    } finally {
      setCancellingAllocationId(null);
    }
  };

  const saveEditAllocation = async (alloc: Allocation, bounty: Bounty) => {
    const amountAda = editDraft.amountAda?.trim();
    if (!amountAda) { toast.error("Invalid amount", "Enter a positive ADA amount."); return; }
    const amountLovelace = rewardToLovelace(amountAda);
    const rank = editDraft.rank?.trim() ? Number(editDraft.rank.trim()) : alloc.rank;

    if (!Number.isInteger(amountLovelace) || amountLovelace <= 0) {
      toast.error("Invalid amount", "Amount must be a positive number.");
      return;
    }
    try {
      const res = await authFetch(`/api/admin/allocations/${alloc.id}`, {
        method: "PATCH",
        headers: { Accept: "application/json" },
        body: JSON.stringify({ amount_lovelace: amountLovelace, rank }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Unable to update allocation.");
      const allocations = await loadAllocations(bounty.id);
      updateBountyAllocations(bounty.id, allocations);
      setEditingAllocationId(null);
      setEditDraft({});
      toast.success("Allocation updated", "The allocation has been saved.");
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : "Unable to update allocation.");
    }
  };

  // ── Release payment handlers ──────────────────────────────
  const openReleaseModal = (alloc: Allocation, bounty: Bounty) => {
    setSelectedAlloc(alloc);
    setSelectedBounty(bounty);
    setTxHash("");
    setResolvedAddress(null);
    setResolvedSource(null);
    setResolveError(null);
    
    const stake = alloc.users?.stake_address;
    if (stake) {
      setResolvingAddress(true);
      authFetch(`/api/users/resolve-address?stake=${stake}`)
        .then(async (res) => {
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(payload.error || "Failed to resolve payment address");
          }
          setResolvedAddress(payload.payment_address || null);
          setResolvedSource(payload.source || "blockfrost");
        })
        .catch((err) => {
          setResolveError(err instanceof Error ? err.message : "Unable to resolve payment address.");
        })
        .finally(() => {
          setResolvingAddress(false);
        });
    } else {
      setResolveError("Contributor stake address is missing.");
    }
  };

  const closeModal = () => {
    setSelectedAlloc(null);
    setSelectedBounty(null);
    setTxHash("");
    setResolvingAddress(false);
    setResolvedAddress(null);
    setResolvedSource(null);
    setResolveError(null);
  };

  useEscapeKey(closeModal, Boolean(selectedAlloc));

  // Optimistic update after successful payout
  const markAllocPaid = (allocId: string, hash: string, newBountyStatus?: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const updateBountyList = (list: Bounty[] | undefined) =>
        (list ?? []).map((b) => {
          const updatedAllocs = (b.allocations ?? []).map((a) =>
            a.id === allocId ? { ...a, status: "paid" as AllocationStatus, transaction_hash: hash } : a,
          );
          const hasAlloc = (b.allocations ?? []).some(a => a.id === allocId);
          const bountyStatus = (hasAlloc && newBountyStatus) ? newBountyStatus : b.status;
          return { ...b, allocations: updatedAllocs, status: bountyStatus };
        });
      return {
        ...prev,
        queues: {
          ...prev.queues,
          bounties: updateBountyList(prev.queues.bounties),
          in_review_bounties: updateBountyList(prev.queues.in_review_bounties),
        },
      };
    });
  };

  const recordManualPayout = async () => {
    if (!selectedAlloc) return;
    if (!txHash.trim()) {
      toast.error("Validation error", "Provide a 64-character transaction hash.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await authFetch("/api/admin/release-payment", {
        method: "POST",
        body: JSON.stringify({ allocation_id: selectedAlloc.id, transaction_hash: txHash.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Action failed.");
      toast.success("Payout recorded", "Allocation marked as paid.");
      markAllocPaid(selectedAlloc.id, txHash.trim(), payload.bounty_status);
      closeModal();
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : "Unable to record payout.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeOnChainPayout = async () => {
    if (!selectedAlloc || !selectedBounty) return;
    if (!wallet || !address) {
      toast.error("Wallet required", "Connect a wallet to execute on-chain payouts.");
      return;
    }
    const recipientAddress = resolvedAddress;
    if (!recipientAddress) {
      toast.error("Address missing", "Could not resolve a payment address for the contributor.");
      return;
    }
    if (!selectedBounty.escrow_tx_hash) {
      toast.error("Data missing", "Bounty escrow transaction hash is missing.");
      return;
    }
    setIsExecutingOnChain(true);
    try {
      toast.info("Building transaction", "Preparing payout transaction...");
      const newTxHash = await releaseBountyPayout({
        wallet,
        recipientAddress,
        lovelace: Number(selectedAlloc.amount_lovelace),
      });
      toast.success("Transaction submitted", `Tx: ${shortId(newTxHash)}`);
      const res = await authFetch("/api/admin/release-payment", {
        method: "POST",
        body: JSON.stringify({ allocation_id: selectedAlloc.id, transaction_hash: newTxHash }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Warning", "On-chain tx submitted but backend recording failed. Record manually.");
        setTxHash(newTxHash);
      } else {
        toast.success("Payout complete", "Allocation recorded as paid.");
        markAllocPaid(selectedAlloc.id, newTxHash, payload.bounty_status);
        closeModal();
      }
    } catch (err) {
      toast.error("Execution failed", err instanceof Error ? err.message : "Could not execute on-chain payout.");
    } finally {
      setIsExecutingOnChain(false);
    }
  };

  return {
    isLoading,
    error,
    search,
    setSearch,
    filter,
    setFilter,
    sortCol,
    sortDesc,
    handleSort,
    payoutBounties,
    loadData,
    // Expanded state
    expandedBountyIds,
    toggleExpand,
    // Allocation drafts & edits
    allocationDrafts,
    setAllocationDrafts,
    getDraftKey,
    editingAllocationId,
    setEditingAllocationId,
    editDraft,
    setEditDraft,
    saveEditAllocation,
    // Actions & loading states
    reviewingBountyId,
    startReview,
    allocatingSubmissionId,
    createAllocation,
    finalizingBountyId,
    finalizeWinners,
    cancellingAllocationId,
    cancelAllocation,
    getAllocationDefaults,
    // Payment Modal state & actions
    selectedAlloc,
    selectedBounty,
    txHash,
    setTxHash,
    resolvingAddress,
    resolvedAddress,
    resolvedSource,
    resolveError,
    isSubmitting,
    isExecutingOnChain,
    openReleaseModal,
    closeModal,
    recordManualPayout,
    executeOnChainPayout,
  };
}

