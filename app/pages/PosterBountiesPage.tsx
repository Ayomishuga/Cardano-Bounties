"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import styles from "./AdminQueue.module.css";
import type { Bounty, Submission, PosterDashboardResponse } from "@/types/bounty";
import {
  formatAda,
  normalizeStatus,
  shortId,
  formatDate,
  formatDateTime,
  formatRelativeTime,
} from "@/lib/formatters";
import { getBountyCategoryLabel } from "@/lib/bountyHelpers";
import { CopyIconButton } from "@/components/shared/CopyIconButton";
import { StatusPill } from "@/components/shared/StatusPill";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { ModalCloseButton } from "@/components/shared/ModalCloseButton";
import { ModalNavControls } from "@/components/shared/ModalNavControls";
import { useItemNavigation } from "@/hooks/useItemNavigation";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { TableActionChevron } from "@/components/shared/TableActionChevron";

function canRetryEscrow(bounty: Bounty) {
  return bounty.status === "pending_escrow" && Boolean(bounty.escrow_tx_hash);
}

function getReviewCounts(bounty: Bounty) {
  const submissions = bounty.submissions || [];
  return {
    total: submissions.length,
    pending: submissions.filter((submission) => submission.status === "pending").length,
    approved: submissions.filter((submission) => ["approved", "paid"].includes(submission.status)).length,
    rejected: submissions.filter((submission) => submission.status === "rejected").length,
  };
}

export function PosterBountiesPage() {
  const toast = useToast();
  const [data, setData] = useState<PosterDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"title" | "status" | "reward" | "submissions" | "posted">("posted");
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedBountyId, setSelectedBountyId] = useState<string | null>(null);
  const [verifyingBountyId, setVerifyingBountyId] = useState<string | null>(null);
  const [extendingBountyId, setExtendingBountyId] = useState<string | null>(null);

  const loadBounties = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/dashboard/poster", { headers: { Accept: "application/json" } });
      const payload = (await response.json()) as PosterDashboardResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load bounties.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load bounties.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBounties();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadBounties]);

  const bounties = useMemo(() => data?.queues?.bounties || [], [data]);
  const items = useMemo(() => {
    let list = [...bounties];

    if (filter !== "all") {
      list = list.filter((bounty) => bounty.status === filter);
    }

    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter((bounty) =>
        bounty.title.toLowerCase().includes(query) ||
        (bounty.project_name || "").toLowerCase().includes(query) ||
        (bounty.description || "").toLowerCase().includes(query),
      );
    }

    list.sort((a, b) => {
      let comparison = 0;
      switch (sortCol) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "reward":
          comparison = Number(a.reward_amount || 0) - Number(b.reward_amount || 0);
          break;
        case "submissions":
          comparison = (a.submissions?.length || 0) - (b.submissions?.length || 0);
          break;
        case "posted":
          comparison = (a.created_at ? new Date(a.created_at).getTime() : 0) - (b.created_at ? new Date(b.created_at).getTime() : 0);
          break;
      }

      return sortDesc ? -comparison : comparison;
    });

    return list;
  }, [bounties, filter, search, sortCol, sortDesc]);

  const { selectedItem, canGoPrev, canGoNext, goToPrev, goToNext } = useItemNavigation(
    items,
    selectedBountyId,
    setSelectedBountyId
  );
  const pendingEscrow = bounties.filter((bounty) => bounty.status === "pending_escrow").length;
  const awaitingAdmin = bounties.filter((bounty) => bounty.status === "awaiting_admin_review").length;

  const summaryItems = [
    ["Total", bounties.length],
    ["Open", data?.metrics?.open_bounties || 0],
    ["Pending escrow", pendingEscrow],
    ["Awaiting admin", awaitingAdmin],
  ];

  function handleSort(col: typeof sortCol) {
    if (sortCol === col) {
      setSortDesc((current) => !current);
    } else {
      setSortCol(col);
      setSortDesc(true);
    }
  }

  async function handleRetryEscrow(bounty: Bounty) {
    setVerifyingBountyId(bounty.id);
    try {
      const response = await authFetch(`/api/bounties/${bounty.id}/escrow/verify`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok && response.status !== 202) {
        throw new Error(payload.error || "Unable to verify escrow transaction.");
      }

      await loadBounties();

      if (payload.verification_pending || response.status === 202) {
        toast.info(
          "Escrow still pending",
          payload.error || "Blockfrost has not confirmed the transaction yet. Retry again shortly.",
        );
        return;
      }

      toast.success("Escrow verified", "This bounty is now awaiting admin approval.");
    } catch (err) {
      toast.error("Verification failed", err instanceof Error ? err.message : "Unable to verify escrow transaction.");
    } finally {
      setVerifyingBountyId(null);
    }
  }

  async function handleExtendDeadline(bounty: Bounty, newDeadline: string) {
    setExtendingBountyId(bounty.id);
    try {
      const response = await authFetch(`/api/bounties/${bounty.id}/extend`, {
        method: "PATCH",
        body: JSON.stringify({ new_deadline: newDeadline }),
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to extend deadline.");
      await loadBounties();
      toast.success("Deadline Extended", `New deadline set to ${newDeadline}.`);
    } catch (err) {
      toast.error("Extension failed", err instanceof Error ? err.message : "Unable to extend deadline.");
    } finally {
      setExtendingBountyId(null);
    }
  }

  const columns = useMemo<ColumnDef<Bounty>[]>(
    () => [
      {
        id: "title",
        header: "Bounty",
        sortable: true,
        cell: (bounty) => (
          <>
            <span className={styles.bountyTitle} title={bounty.title}>{bounty.title}</span>
            <div className={styles.date}>{getBountyCategoryLabel(bounty)}</div>
          </>
        ),
      },
      {
        id: "status",
        header: "Status",
        sortable: true,
        cell: (bounty) => <StatusPill status={bounty.status} />,
      },
      {
        id: "reward",
        header: "Reward",
        align: "right",
        sortable: true,
        cell: (bounty) => <div className={styles.amount}>{formatAda(bounty.reward_amount)}</div>,
      },
      {
        id: "submissions",
        header: "Submissions",
        align: "right",
        sortable: true,
        cell: (bounty) => {
          const counts = getReviewCounts(bounty);
          return <div className={styles.amount}>{counts.total}</div>;
        },
      },
      {
        id: "posted",
        header: "Posted",
        sortable: true,
        cell: (bounty) => (
          <span className={styles.date} title={bounty.created_at ? new Date(bounty.created_at).toLocaleString() : undefined}>
            {formatRelativeTime(bounty.created_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        sortable: false,
        cell: (bounty) => (
          <div className={styles.actions}>
            {canRetryEscrow(bounty) ? (
              <button
                type="button"
                className={styles.approveBtn}
                disabled={verifyingBountyId === bounty.id}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleRetryEscrow(bounty);
                }}
                style={{ padding: "4px 10px", fontSize: 11, minHeight: "auto", marginRight: 8 }}
              >
                {verifyingBountyId === bounty.id ? "Checking..." : "Retry"}
              </button>
            ) : null}
            <TableActionChevron ariaLabel="View bounty" icon="eye" />
          </div>
        ),
      },
    ],
    [verifyingBountyId]
  );

  return (
    <div className={styles.container}>
      <section className={styles.tableWrap}>
        <div className={styles.queueSummaryGrid}>
          {summaryItems.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.controls}>
        <div className={styles.tabs} role="tablist" aria-label="Bounty status filters">
          {[
            ["all", "All"],
            ["pending_escrow", "Pending escrow"],
            ["awaiting_admin_review", "Awaiting admin"],
            ["open", "Open"],
            ["in_review", "In review"],
            ["completed", "Completed"],
            ["expired", "Expired"],
          ].map(([value, label]) => (
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
            placeholder="Search bounty, project, or description..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search bounties"
          />
        </div>
      </div>

      <DataTable
        data={items}
        columns={columns}
        ariaLabel="My bounties"
        sortCol={sortCol}
        sortDesc={sortDesc}
        onSort={handleSort}
        onRowClick={(bounty) => setSelectedBountyId(bounty.id)}
        isLoading={isLoading}
        error={error}
        onRetry={() => void loadBounties()}
        emptyState={{
          title: search || filter !== "all" ? "No matching bounties" : "No posted bounties yet",
          description: search || filter !== "all" ? "No bounties match your current filters." : "Post a bounty to start receiving submissions.",
          action: search || filter !== "all" ? (
            <button type="button" className={styles.clearFilterBtn} onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button>
          ) : (
            <Link href="/post-bounty" className={styles.clearFilterBtn}>Post bounty</Link>
          ),
        }}
      />

      {selectedItem ? (
        <PosterBountyModal
          bounty={selectedItem}
          canGoNext={canGoNext}
          canGoPrev={canGoPrev}
          isExtending={extendingBountyId === selectedItem.id}
          isVerifying={verifyingBountyId === selectedItem.id}
          onClose={() => setSelectedBountyId(null)}
          onExtendDeadline={handleExtendDeadline}
          onNext={goToNext}
          onPrev={goToPrev}
          onRetryEscrow={handleRetryEscrow}
        />
      ) : null}
    </div>
  );
}

function PosterBountyModal({
  bounty,
  canGoNext,
  canGoPrev,
  isExtending,
  isVerifying,
  onClose,
  onExtendDeadline,
  onNext,
  onPrev,
  onRetryEscrow,
}: {
  bounty: Bounty;
  canGoNext: boolean;
  canGoPrev: boolean;
  isExtending: boolean;
  isVerifying: boolean;
  onClose: () => void;
  onExtendDeadline: (bounty: Bounty, newDeadline: string) => Promise<void>;
  onNext: () => void;
  onPrev: () => void;
  onRetryEscrow: (bounty: Bounty) => Promise<void>;
}) {
  const counts = getReviewCounts(bounty);
  const [extendMode, setExtendMode] = useState(false);
  const [newDeadline, setNewDeadline] = useState("");

  const extensionsUsed = bounty.deadline_extended_count ?? 0;
  const extensionsRemaining = 2 - extensionsUsed;
  const canExtend = bounty.status === "open" && extensionsUsed < 2;

  // Compute the minimum allowed date (today + 7 days) for the date picker
  const minDate = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className={styles.modalBackdrop} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="poster-bounty-modal-title">
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <StatusPill status={bounty.status} />
            <span className={styles.modalAmount}>{formatAda(bounty.reward_amount)}</span>
            <span className={styles.modalMetaPill}>{normalizeStatus(bounty.payout_type || "single")}</span>
          </div>
          <ModalCloseButton onClose={onClose} size={20} />
        </div>

        <div className={styles.modalBody}>
          <h3 id="poster-bounty-modal-title" className={styles.modalTitle}>{bounty.title}</h3>

          <div className={styles.submitterInfo}>
            <InitialsAvatar name={getBountyCategoryLabel(bounty)} />
            <span className={styles.handle} style={{ fontSize: "14px" }}>{bounty.project_name || "Independent bounty"}</span>
            <div className={styles.hashGroup}>
              <span>ID: {shortId(bounty.id)}</span>
              <CopyIconButton
                text={bounty.id}
                label="Copy bounty ID"
                className={styles.copyBtn}
              />
            </div>
          </div>

          <div className={styles.contentSection}>
            <div className={styles.contentBlock} style={{ display: "flex", gap: 0 }}>
              <div style={{ flex: 1 }}>
                <div className={styles.contentLabel}>Created</div>
                <div className={styles.contentValue}>{formatDateTime(bounty.created_at)}</div>
              </div>
              <div style={{ flex: 1, borderLeft: "1px solid var(--line)", paddingLeft: 16 }}>
                <div className={styles.contentLabel}>Deadline</div>
                <div className={styles.contentValue}>{formatDate(bounty.deadline)}</div>
              </div>
            </div>

            <div className={styles.contentBlock} style={{ display: "flex", gap: 0 }}>
              <div style={{ flex: 1 }}>
                <div className={styles.contentLabel}>Contributor reward</div>
                <div className={styles.contentValue}>{formatAda(bounty.reward_amount)}</div>
              </div>
              <div style={{ flex: 1, borderLeft: "1px solid var(--line)", paddingLeft: 16 }}>
                <div className={styles.contentLabel}>Total funded</div>
                <div className={styles.contentValue}>{formatAda(bounty.total_funding_amount || bounty.reward_amount)}</div>
              </div>
            </div>

            <div className={styles.contentBlock}>
              <div className={styles.contentLabel}>Description</div>
              <div className={`${styles.contentValue} ${!bounty.description ? styles.missingValue : ""}`}>
                {bounty.description || "No description provided."}
              </div>
            </div>

            <div className={styles.contentBlock}>
              <div className={styles.contentLabel}>Instructions</div>
              <div className={`${styles.contentValue} ${!bounty.bounty_instructions ? styles.missingValue : ""}`}>
                {bounty.bounty_instructions || "No bounty instructions provided."}
              </div>
            </div>

            <div className={styles.contentBlock}>
              <div className={styles.posterReviewHeader}>
                <div>
                  <div className={styles.contentLabel}>Submission activity</div>
                  <div className={styles.contentValue}>
                    {counts.total} total, {counts.pending} pending, {counts.approved} approved, {counts.rejected} rejected
                  </div>
                </div>
                <span>{bounty.max_winners || 1} winner{Number(bounty.max_winners || 1) === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>

          <section className={styles.contextPanel} aria-label="Bounty lifecycle context">
            <div className={styles.contextHeader}>
              <span>Lifecycle context</span>
            </div>
            <div className={styles.contextBody}>
              <div className={styles.contextMetaGrid}>
                <div>
                  <span>Category</span>
                  <strong>{getBountyCategoryLabel(bounty)}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{normalizeStatus(bounty.status)}</strong>
                </div>
                <div>
                  <span>Last escrow check</span>
                  <strong>{formatDateTime(bounty.escrow_last_checked_at)}</strong>
                </div>
                <div>
                  <span>Attempts</span>
                  <strong>{bounty.escrow_verification_attempts || 0}</strong>
                </div>
              </div>
              <div className={styles.contextBlock}>
                <div className={styles.contentLabel}>Escrow transaction</div>
                <div className={`${styles.contentValue} ${!bounty.escrow_tx_hash ? styles.missingValue : ""}`}>
                  {bounty.escrow_tx_hash ? shortId(bounty.escrow_tx_hash) : "No escrow transaction hash recorded."}
                </div>
              </div>
              {bounty.escrow_verification_error ? (
                <div className={styles.contextBlock} data-emphasis="true">
                  <div className={styles.contentLabel}>Latest verification message</div>
                  <div className={styles.contentValue}>{bounty.escrow_verification_error}</div>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {/* Inline extend-deadline form */}
        {extendMode && canExtend ? (
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label htmlFor="new-deadline-input" style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              New deadline:
            </label>
            <input
              id="new-deadline-input"
              type="date"
              min={minDate}
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              style={{ flex: 1, minWidth: 140, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", fontSize: 13 }}
            />
            <button
              type="button"
              className={styles.approveBtn}
              style={{ padding: "6px 14px", fontSize: 13, minHeight: "auto" }}
              disabled={!newDeadline || isExtending}
              onClick={() => {
                if (newDeadline) void onExtendDeadline(bounty, newDeadline).then(() => setExtendMode(false));
              }}
            >
              {isExtending ? <div className={styles.spinner} /> : "Confirm"}
            </button>
            <button
              type="button"
              className={styles.clearFilterBtn}
              style={{ padding: "6px 14px", fontSize: 13, minHeight: "auto" }}
              onClick={() => { setExtendMode(false); setNewDeadline(""); }}
            >
              Cancel
            </button>
          </div>
        ) : null}

        <div className={styles.modalFooter}>
          <ModalNavControls
            itemLabel="bounty"
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onPrev={onPrev}
            onNext={onNext}
          />
          {canRetryEscrow(bounty) ? (
            <button type="button" className={styles.approveBtn} disabled={isVerifying} onClick={() => void onRetryEscrow(bounty)}>
              {isVerifying ? <div className={styles.spinner} /> : "Retry verification"}
            </button>
          ) : null}
          {canExtend && !extendMode ? (
            <button
              type="button"
              className={styles.clearFilterBtn}
              title={`${extensionsRemaining} extension${extensionsRemaining === 1 ? "" : "s"} remaining`}
              onClick={() => setExtendMode(true)}
            >
              Extend deadline
            </button>
          ) : null}
          {bounty.status === "open" || bounty.status === "in_review" ? (
            <Link href={`/bounties/${bounty.id}`} className={styles.clearFilterBtn}>
              View public page
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
