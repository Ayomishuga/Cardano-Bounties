"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import styles from "./AdminQueue.module.css";
import { releaseBountyPayout } from "@/lib/cardano/transactions/bountyEscrow";
import { useAppWallet } from "@/components/wallet/WalletProvider";
import { LOVELACE_PER_ADA } from "@/lib/bountyContract";

// ── Types ─────────────────────────────────────────────────────
type AllocationStatus = "pending" | "processing" | "paid" | "failed" | "cancelled";

type Allocation = {
  id: string;
  bounty_id: string;
  submission_id: string;
  contributor_id: string;
  amount_lovelace: number | string;
  rank: number | null;
  status: AllocationStatus;
  transaction_hash: string | null;
  paid_at: string | null;
  created_at: string;
  users?: { id: string; stake_address?: string | null; display_name?: string | null } | null;
  submissions?: { id: string; content?: string | null; submitted_at?: string | null } | null;
};

type Prize = {
  rank: number;
  amount_lovelace: number;
};

type BountySubmission = {
  id: string;
  status: string;
  contributor_id?: string | null;
  content?: string | null;
  submitted_at?: string | null;
};

type Bounty = {
  id: string;
  title: string;
  status: string;
  reward_amount?: number | string | null;
  payout_type?: string | null;
  max_winners?: number | null;
  winners_finalized?: boolean;
  prize_structure?: Prize[] | null;
  escrow_tx_hash?: string | null;
  allocations?: Allocation[];
  submissions?: BountySubmission[];
};

type DashboardResponse = {
  queues: {
    bounties?: Bounty[];
    in_review_bounties?: Bounty[];
  };
  error?: string;
};

type AllocationDraft = {
  amountAda?: string;
  rank?: string;
};

// ── Helpers ───────────────────────────────────────────────────
function lovelaceToAda(lovelace: number | string | null | undefined) {
  const lv = Number(lovelace || 0);
  return lv / LOVELACE_PER_ADA;
}

function formatAda(lovelace: number | string | null | undefined) {
  const ada = lovelaceToAda(lovelace);
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(ada)} ADA`;
}

function formatAdaValue(lovelace: number | string | null | undefined) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(lovelaceToAda(lovelace));
}

function rewardToLovelace(rewardAda: number | string | null | undefined) {
  return Math.round(Number(rewardAda || 0) * LOVELACE_PER_ADA);
}

function shortId(value: string | null | undefined) {
  if (!value) return "Unknown";
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.slice(0, 2).toUpperCase();
}

function normalizeStatus(value: string | null | undefined) {
  if (!value) return "Pending";
  return value.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function getHandle(alloc: Allocation) {
  return alloc.users?.display_name || shortId(alloc.users?.stake_address || alloc.contributor_id);
}

function getSubmissionHandle(submission: BountySubmission) {
  return shortId(submission.contributor_id);
}

const RANK_LABEL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
function rankLabel(rank: number | null) {
  if (!rank) return "";
  return `${RANK_LABEL[rank] ?? `#${rank}`} `;
}

// ── Component ─────────────────────────────────────────────────
export function AdminPayoutsPage() {
  const toast = useToast();
  const { wallet, address } = useAppWallet();

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "needs_allocation" | "ready_to_pay" | "partially_paid" | "completed">("all");
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExecutingOnChain, setIsExecutingOnChain] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

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
    // Use the full bounties list — filter to payout-relevant statuses
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

    if (filter === "needs_allocation") list = list.filter((b) => b.status === "in_review" && !b.winners_finalized);
    if (filter === "ready_to_pay")     list = list.filter((b) => b.status === "payout_pending");
    if (filter === "partially_paid")   list = list.filter((b) => b.status === "partially_paid");
    if (filter === "completed")        list = list.filter((b) => b.status === "completed");

    return list;
  }, [data, search, filter]);

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
  };

  const closeModal = () => {
    setSelectedAlloc(null);
    setSelectedBounty(null);
    setTxHash("");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedAlloc) closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedAlloc]);

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
    const recipientAddress = selectedAlloc.users?.stake_address;
    if (!recipientAddress) {
      toast.error("Data missing", "Contributor stake address is missing.");
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

  // Optimistic update after successful payout
  const markAllocPaid = (allocId: string, hash: string, newBountyStatus?: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const updateBountyList = (list: Bounty[] | undefined) =>
        (list ?? []).map((b) => {
          const updatedAllocs = (b.allocations ?? []).map((a) =>
            a.id === allocId ? { ...a, status: "paid" as AllocationStatus, transaction_hash: hash } : a,
          );
          const bountyStatus = newBountyStatus ?? b.status;
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

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1500);
    } catch {
      // ignore
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.tabs} role="tablist">
          {([
            { value: "all",              label: "All" },
            { value: "needs_allocation", label: "Needs allocation" },
            { value: "ready_to_pay",     label: "Ready to pay" },
            { value: "partially_paid",   label: "Partially paid" },
            { value: "completed",        label: "Completed" },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              className={styles.tab}
              data-active={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.search}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search bounty title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter bounties"
          />
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        {isLoading ? (
          <table className={styles.table} aria-label="Loading payouts">
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} aria-hidden="true">
                  <td><div className={styles.shimmer} style={{ width: "220px" }} /></td>
                  <td><div className={styles.shimmer} style={{ width: "80px" }} /></td>
                  <td><div className={styles.shimmer} style={{ width: "60px" }} /></td>
                  <td><div className={styles.shimmer} style={{ width: "80px", marginLeft: "auto" }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : error ? (
          <div className={styles.emptyState}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3>Could not load payouts</h3>
            <p>{error}</p>
            <button type="button" className={styles.clearFilterBtn} onClick={() => void loadData()}>Retry</button>
          </div>
        ) : payoutBounties.length === 0 ? (
          <div className={styles.emptyState}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            {search || filter !== "all" ? (
              <>
                <h3>No matching bounties</h3>
                <p>No bounties match your current filters.</p>
                <button type="button" className={styles.clearFilterBtn} onClick={() => { setFilter("all"); setSearch(""); }}>Clear filters</button>
              </>
            ) : (
              <>
                <h3>No payouts queued</h3>
                <p>Bounties move here once they are in review, have approved submissions ready for review, or are awaiting payout.</p>
              </>
            )}
          </div>
        ) : (
          <table className={styles.table} role="grid" aria-label="Bounty Payouts">
            <thead>
              <tr>
                <th><div className={styles.thContent}>Bounty</div></th>
                <th><div className={styles.thContent}>Payout type</div></th>
                <th><div className={styles.thContent}>Reward pool</div></th>
                <th><div className={`${styles.thContent} ${styles.right}`}>Bounty status</div></th>
                <th><div className={`${styles.thContent} ${styles.right}`}>Actions</div></th>
              </tr>
            </thead>
            <tbody>
              {payoutBounties.map((bounty) => {
                const isExpanded = expandedBountyIds.has(bounty.id);
                const allocs = bounty.allocations ?? [];
                const activeAllocations = allocs.filter((a) => a.status !== "cancelled");
                const allocatedSubmissionIds = new Set(activeAllocations.map((a) => a.submission_id));
                const approvedSubmissions = (bounty.submissions ?? []).filter(
                  (submission) => submission.status === "approved" && !allocatedSubmissionIds.has(submission.id),
                );
                const allocatedTotal = activeAllocations.reduce((sum, allocation) => sum + Number(allocation.amount_lovelace || 0), 0);
                const rewardLovelace = rewardToLovelace(bounty.reward_amount);
                const canFinalize = bounty.status === "in_review" && activeAllocations.length > 0 && allocatedTotal === rewardLovelace;
                const paidCount = allocs.filter((a) => a.status === "paid").length;

                return (
                  <Fragment key={bounty.id}>
                    {/* Bounty parent row */}
                    <tr
                      key={bounty.id}
                      onClick={() => void toggleExpand(bounty)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void toggleExpand(bounty); } }}
                      aria-expanded={isExpanded}
                      style={{ cursor: "pointer", fontWeight: 600 }}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className={`${styles.expandChevron}`} data-open={String(isExpanded)} aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </span>
                          <span className={styles.bountyTitle} title={bounty.title}>{bounty.title}</span>
                        </div>
                      </td>
                      <td>
                        <span className={styles.statusPill} data-status="open" style={{ textTransform: "capitalize" }}>
                          {bounty.payout_type?.replace(/_/g, " ") ?? "single"}
                        </span>
                      </td>
                      <td>
                        <div className={styles.amount}>{formatAda((Number(bounty.reward_amount ?? 0) * LOVELACE_PER_ADA).toString())}</div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className={styles.statusPill} data-status={bounty.status.toLowerCase()}>
                          {normalizeStatus(bounty.status)}
                        </span>
                        {bounty.allocations && (
                          <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
                            {paidCount}/{allocs.filter(a => a.status !== "cancelled").length} paid
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          aria-label={isExpanded ? "Collapse allocations" : "Expand allocations"}
                          tabIndex={-1}
                          style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points={isExpanded ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
                          </svg>
                        </button>
                        {bounty.status === "open" ? (
                          <button
                            type="button"
                            className={styles.approveBtn}
                            disabled={reviewingBountyId === bounty.id}
                            style={{ marginLeft: 8, padding: "4px 12px", fontSize: 11, minHeight: "auto" }}
                            onClick={(event) => {
                              event.stopPropagation();
                              void startReview(bounty);
                            }}
                          >
                            {reviewingBountyId === bounty.id ? "Starting..." : "Start review"}
                          </button>
                        ) : null}
                      </td>
                    </tr>

                    {isExpanded && (
                      <>
                        {allocs.map((alloc) => {
                          const handle = getHandle(alloc);
                          const isPaid = alloc.status === "paid";
                          const isPending = alloc.status === "pending";
                          const canEditAlloc = bounty.status === "in_review" && !bounty.winners_finalized && isPending;
                          const isEditing = editingAllocationId === alloc.id;
                          const isCancelling = cancellingAllocationId === alloc.id;

                          if (isEditing) {
                            return (
                              <tr key={alloc.id} className={styles.childRow} style={{ background: "rgba(234,179,8,0.06)" }}>
                                <td style={{ paddingLeft: 40 }}>
                                  <div className={styles.submitter}>
                                    <div className={styles.avatar} aria-hidden="true">{getInitials(handle)}</div>
                                    <span className={styles.handle}>{rankLabel(alloc.rank)}{handle}</span>
                                  </div>
                                </td>
                                <td>
                                  <input
                                    type="number" min="1" step="1"
                                    value={editDraft.rank ?? (alloc.rank ? String(alloc.rank) : "")}
                                    placeholder="Rank"
                                    aria-label="Rank"
                                    disabled={bounty.payout_type === "single"}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, rank: e.target.value }))}
                                    style={{ width: 76, padding: "7px 8px", border: "1px solid var(--border)", borderRadius: 8 }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number" min="0" step="0.000001"
                                    value={editDraft.amountAda ?? String(Number(alloc.amount_lovelace) / LOVELACE_PER_ADA)}
                                    aria-label="Amount in ADA"
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, amountAda: e.target.value }))}
                                    style={{ width: 120, padding: "7px 8px", border: "1px solid var(--border)", borderRadius: 8 }}
                                  />
                                  <span style={{ marginLeft: 6, fontSize: 12, color: "var(--muted)" }}>ADA</span>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <span className={styles.statusPill} data-status="pending">Editing</span>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <button
                                    type="button" className={styles.approveBtn}
                                    style={{ padding: "4px 12px", fontSize: 11, minHeight: "auto", marginRight: 4 }}
                                    onClick={(e) => { e.stopPropagation(); void saveEditAllocation(alloc, bounty); }}
                                  >Save</button>
                                  <button
                                    type="button"
                                    className={`${styles.iconBtn} ${styles.danger}`}
                                    title="Discard edit"
                                    onClick={(e) => { e.stopPropagation(); setEditingAllocationId(null); setEditDraft({}); }}
                                    aria-label="Discard edit"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr
                              key={alloc.id}
                              className={styles.childRow}
                              style={{ background: "rgba(1,81,194,0.025)", cursor: (isPending && bounty.winners_finalized) ? "pointer" : "default" }}
                              onClick={() => { if (isPending && bounty.winners_finalized) openReleaseModal(alloc, bounty); }}
                            >
                              <td style={{ paddingLeft: 40 }}>
                                <div className={styles.submitter}>
                                  <div className={styles.avatar} aria-hidden="true">{getInitials(handle)}</div>
                                  <div>
                                    <span className={styles.handle} title={handle}>{rankLabel(alloc.rank)}{handle}</span>
                                    {alloc.transaction_hash && (
                                      <span style={{ display: "block", fontFamily: "monospace", fontSize: 10, color: "var(--muted)" }}>
                                        {shortId(alloc.transaction_hash)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td><div className={styles.amount}>{formatAda(alloc.amount_lovelace)}</div></td>
                              <td>
                                <span className={styles.statusPill} data-status={alloc.status}>
                                  {normalizeStatus(alloc.status)}
                                </span>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                {isPaid ? (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Paid">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                ) : isPending && bounty.winners_finalized ? (
                                  <button
                                    type="button" className={styles.approveBtn}
                                    style={{ padding: "4px 12px", fontSize: 11, minHeight: "auto" }}
                                    onClick={(e) => { e.stopPropagation(); openReleaseModal(alloc, bounty); }}
                                    aria-label="Release payment"
                                  >Release</button>
                                ) : null}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                {canEditAlloc && (
                                  <>
                                    <button
                                      type="button"
                                      className={styles.iconBtn}
                                      title="Edit allocation"
                                      onClick={(e) => { e.stopPropagation(); setEditingAllocationId(alloc.id); setEditDraft({ amountAda: String(Number(alloc.amount_lovelace) / LOVELACE_PER_ADA), rank: alloc.rank ? String(alloc.rank) : "" }); }}
                                      aria-label="Edit allocation"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      className={`${styles.iconBtn} ${styles.danger}`}
                                      title="Cancel allocation"
                                      disabled={isCancelling}
                                      onClick={(e) => { e.stopPropagation(); void cancelAllocation(alloc, bounty); }}
                                      aria-label="Cancel allocation"
                                    >
                                      {isCancelling
                                        ? <div className={styles.spinner} style={{ width: 12, height: 12 }} />
                                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                          </svg>
                                      }
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {bounty.winners_finalized && allocs.filter(a => a.status !== "cancelled").length > 0 && (() => {
                          const paidLv  = allocs.filter(a => a.status === "paid").reduce((s, a) => s + Number(a.amount_lovelace), 0);
                          const remainLv = rewardLovelace - paidLv;
                          return (
                            <tr key={`${bounty.id}-pay-summary`}>
                              <td colSpan={5} style={{ paddingLeft: 40, paddingTop: 6, paddingBottom: 6 }}>
                                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                                  Pool: <strong>{formatAdaValue(rewardLovelace)} ADA</strong>
                                  {" · "}Paid: <strong style={{ color: "#16a34a" }}>{formatAdaValue(paidLv)} ADA</strong>
                                  {" · "}Remaining: <strong style={{ color: remainLv > 0 ? "var(--blue)" : "var(--muted)" }}>{formatAdaValue(remainLv)} ADA</strong>
                                </span>
                              </td>
                            </tr>
                          );
                        })()}

                        {bounty.status === "open" && approvedSubmissions.length > 0 ? (
                          <tr key={`${bounty.id}-start-review-help`}>
                            <td colSpan={5} style={{ paddingLeft: 40, color: "var(--muted)", fontSize: 12 }}>
                              {approvedSubmissions.length} approved submission{approvedSubmissions.length === 1 ? "" : "s"} ready. Start review to close public submissions and create payout allocations.
                            </td>
                          </tr>
                        ) : null}

                        {bounty.status === "in_review" && approvedSubmissions.map((submission, index) => {
                          const defaults = getAllocationDefaults(bounty, index);
                          const draftKey = getDraftKey(bounty.id, submission.id);
                          const draft = allocationDrafts[draftKey] ?? {};
                          const amountValue = draft.amountAda ?? String(defaults.amountLovelace / LOVELACE_PER_ADA);
                          const rankValue = draft.rank ?? (defaults.rank ? String(defaults.rank) : "");

                          return (
                            <tr key={`${bounty.id}-${submission.id}-candidate`} style={{ background: "rgba(15,118,110,0.035)" }}>
                              <td style={{ paddingLeft: 40 }}>
                                <div className={styles.submitter}>
                                  <div className={styles.avatar} aria-hidden="true">{getInitials(submission.contributor_id || "?")}</div>
                                  <div>
                                    <span className={styles.handle}>{getSubmissionHandle(submission)}</span>
                                    <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                                      Approved submission
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={rankValue}
                                  placeholder="Rank"
                                  aria-label="Allocation rank"
                                  disabled={bounty.payout_type === "single"}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setAllocationDrafts((current) => ({
                                      ...current,
                                      [draftKey]: { ...current[draftKey], rank: value },
                                    }));
                                  }}
                                  style={{ width: 76, padding: "7px 8px", border: "1px solid var(--border)", borderRadius: 8 }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.000001"
                                  value={amountValue}
                                  aria-label="Allocation amount in ADA"
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setAllocationDrafts((current) => ({
                                      ...current,
                                      [draftKey]: { ...current[draftKey], amountAda: value },
                                    }));
                                  }}
                                  style={{ width: 120, padding: "7px 8px", border: "1px solid var(--border)", borderRadius: 8 }}
                                />
                                <span style={{ marginLeft: 6, fontSize: 12, color: "var(--muted)" }}>ADA</span>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <span className={styles.statusPill} data-status="pending">Ready</span>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <button
                                  type="button"
                                  className={styles.approveBtn}
                                  disabled={allocatingSubmissionId === submission.id}
                                  style={{ padding: "4px 12px", fontSize: 11, minHeight: "auto" }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void createAllocation(bounty, submission, defaults);
                                  }}
                                >
                                  {allocatingSubmissionId === submission.id ? "Adding..." : "Add allocation"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {isExpanded && allocs.length === 0 && approvedSubmissions.length === 0 ? (
                          <tr key={`${bounty.id}-no-alloc`}>
                            <td colSpan={5} style={{ paddingLeft: 40, color: "var(--muted)", fontSize: 12, fontStyle: "italic" }}>
                              No payout allocations yet. Approve submissions first, then start review to allocate the reward pool.
                            </td>
                          </tr>
                        ) : null}

                        {bounty.status === "in_review" ? (
                          <tr key={`${bounty.id}-allocation-summary`}>
                            <td colSpan={2} style={{ paddingLeft: 40, fontSize: 12, color: "var(--muted)" }}>
                              Allocated {formatAdaValue(allocatedTotal)} / {formatAdaValue(rewardLovelace)} ADA
                            </td>
                            <td>
                              <div style={{ height: 6, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${Math.min(100, rewardLovelace ? (allocatedTotal / rewardLovelace) * 100 : 0)}%`,
                                    background: allocatedTotal === rewardLovelace ? "var(--success, #16a34a)" : "var(--blue)",
                                  }}
                                />
                              </div>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <span className={styles.statusPill} data-status={canFinalize ? "approved" : "pending"}>
                                {canFinalize ? "Ready to finalize" : "Allocation incomplete"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                type="button"
                                className={styles.approveBtn}
                                disabled={!canFinalize || finalizingBountyId === bounty.id}
                                style={{ padding: "4px 12px", fontSize: 11, minHeight: "auto" }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void finalizeWinners(bounty);
                                }}
                              >
                                {finalizingBountyId === bounty.id ? "Finalizing..." : "Finalize winners"}
                              </button>
                            </td>
                          </tr>
                        ) : null}
                      </>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Release Payment Modal */}
      {selectedAlloc && selectedBounty && (
        <div
          className={styles.modalBackdrop}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderLeft}>
                <span className={styles.statusPill} data-status={selectedAlloc.status}>
                  {normalizeStatus(selectedAlloc.status)}
                </span>
                <span className={styles.modalAmount}>{formatAda(selectedAlloc.amount_lovelace)}</span>
              </div>
              <button type="button" className={styles.closeBtn} onClick={closeModal} aria-label="Close modal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <h3 id="modal-title" className={styles.modalTitle}>
                {rankLabel(selectedAlloc.rank)}{selectedBounty.title}
              </h3>

              <div className={styles.submitterInfo}>
                <div className={styles.avatar} aria-hidden="true">{getInitials(getHandle(selectedAlloc))}</div>
                <span className={styles.handle} style={{ fontSize: 14 }}>{getHandle(selectedAlloc)}</span>
                <div className={styles.hashGroup}>
                  <span>Alloc: {shortId(selectedAlloc.id)}</span>
                  <button type="button" className={styles.copyBtn} aria-label="Copy allocation ID" aria-live="polite" data-copied={copyStatus === "copied"} onClick={() => void handleCopyHash(selectedAlloc.id)}>
                    {copyStatus === "copied" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className={styles.contentSection}>
                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel}>Recipient stake address</div>
                  <div className={styles.contentValue} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, wordBreak: "break-all" }}>
                    {selectedAlloc.users?.stake_address || "Address not recorded"}
                  </div>
                </div>
                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel}>Payout amount</div>
                  <div className={styles.contentValue} style={{ fontWeight: 700, fontSize: 15, color: "var(--blue)" }}>
                    {formatAda(selectedAlloc.amount_lovelace)}
                    <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: "var(--muted)" }}>
                      ({Number(selectedAlloc.amount_lovelace).toLocaleString()} lovelace)
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.adminNoteSection}>
                <label className={styles.contentLabel} htmlFor="tx-hash-modal">Payout transaction hash</label>
                <input
                  id="tx-hash-modal"
                  type="text"
                  className={styles.adminNoteTextarea}
                  style={{ minHeight: "auto", padding: "10px 12px" }}
                  placeholder="64-character Cardano transaction hash"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.rejectBtn} disabled={isSubmitting || isExecutingOnChain} onClick={() => void recordManualPayout()}>
                {isSubmitting ? <div className={styles.spinner} /> : "Record Manual Payout"}
              </button>
              <button type="button" className={styles.approveBtn} disabled={isSubmitting || isExecutingOnChain} onClick={() => void executeOnChainPayout()}>
                {isExecutingOnChain ? <div className={styles.spinner} /> : "Release On-Chain"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
