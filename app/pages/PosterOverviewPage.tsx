"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import styles from "@/app/pages/DashboardPage.module.css";
import queueStyles from "@/app/pages/AdminQueue.module.css";
import { MetricGridShimmer, WorkspaceQueueShimmer, HealthPanelShimmer } from "@/components/dashboard/ShimmerLoaders";
import type { Bounty, Submission, PosterDashboardResponse } from "@/types/bounty";
import { formatAda, shortId, formatDate, formatDateTime } from "@/lib/formatters";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { CopyIconButton } from "@/components/shared/CopyIconButton";
import { StatusPill } from "@/components/shared/StatusPill";
import { ModalCloseButton } from "@/components/shared/ModalCloseButton";
import { ModalNavControls } from "@/components/shared/ModalNavControls";
import { useItemNavigation } from "@/hooks/useItemNavigation";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { TableActionChevron } from "@/components/shared/TableActionChevron";

function canRetryEscrow(bounty: Bounty) {
  return bounty.status === "pending_escrow" && Boolean(bounty.escrow_tx_hash);
}

export function PosterOverviewPage() {
  const toast = useToast();
  const [data, setData] = useState<PosterDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Table state
  const [sortCol, setSortCol] = useState<"title" | "status" | "reward" | "submissions" | "posted">("posted");
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedBountyId, setSelectedBountyId] = useState<string | null>(null);
  const [verifyingBountyId, setVerifyingBountyId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/dashboard/poster", { headers: { Accept: "application/json" } });
      const payload = (await res.json()) as PosterDashboardResponse;
      if (!res.ok) throw new Error("Unable to load dashboard.");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    const interval = window.setInterval(() => void loadDashboard(), 120_000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    if (!data) return [];
    return [
      { label: "My bounties", value: data.metrics.total_bounties },
      { label: "Open bounties", value: data.metrics.open_bounties },
      { label: "Pending reviews", value: data.metrics.pending_submission_reviews },
      { label: "Committed rewards", value: formatAda(data.metrics.committed_ada) },
    ];
  }, [data]);

  const pendingReviews = data?.queues.pending_submission_reviews || [];

  const items = useMemo(() => {
    const list = [...(data?.queues.bounties || [])];
    
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "reward":
          const aAmount = Number(a.reward_amount || 0);
          const bAmount = Number(b.reward_amount || 0);
          cmp = aAmount - bAmount;
          break;
        case "submissions":
          cmp = (a.submissions?.length || 0) - (b.submissions?.length || 0);
          break;
        case "posted":
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
          cmp = aDate - bDate;
          break;
      }
      return sortDesc ? -cmp : cmp;
    });
    
    return list;
  }, [data, sortCol, sortDesc]);

  const { selectedItem, canGoPrev, canGoNext, goToPrev, goToNext } = useItemNavigation(
    items,
    selectedBountyId,
    setSelectedBountyId
  );

  // Bounties expiring within 7 days — used to show the warning banner
  const expiringSoon = useMemo(() => {
    return (data?.queues.bounties || []).filter((bounty) => {
      if (bounty.status !== "open" || !bounty.deadline) return false;
      const diff = new Date(bounty.deadline).getTime() - Date.now();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 7;
    });
  }, [data]);

  const [bannerDismissed, setBannerDismissed] = useState(false);

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(col);
      setSortDesc(true);
    }
  };

  const handleRowClick = (id: string) => {
    setSelectedBountyId(id);
  };

  const handleCloseModal = () => {
    setSelectedBountyId(null);
  };

  useEscapeKey(handleCloseModal, Boolean(selectedBountyId));

  const handleRetryEscrow = async (bounty: Bounty) => {
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

      await loadDashboard();

      if (payload.verification_pending || response.status === 202) {
        toast.info(
          "Escrow still pending",
          payload.error || "Blockfrost has not confirmed the transaction yet. Retry again shortly.",
        );
        return;
      }

      toast.success("Escrow verified", "This bounty is now awaiting admin approval.");
    } catch (err) {
      toast.error(
        "Verification failed",
        err instanceof Error ? err.message : "Unable to verify escrow transaction.",
      );
    } finally {
      setVerifyingBountyId(null);
    }
  };

  const columns = useMemo<ColumnDef<Bounty>[]>(
    () => [
      {
        id: "title",
        header: "Title",
        sortable: true,
        cell: (bounty) => (
          <span className={queueStyles.bountyTitle} title={bounty.title}>
            {bounty.title}
          </span>
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
        cell: (bounty) => <div className={queueStyles.amount}>{formatAda(bounty.reward_amount)}</div>,
      },
      {
        id: "submissions",
        header: "Submissions",
        align: "right",
        sortable: true,
        cell: (bounty) => <div className={queueStyles.amount}>{bounty.submissions?.length ?? 0}</div>,
      },
      {
        id: "posted",
        header: "Posted",
        sortable: true,
        cell: (bounty) => <span className={queueStyles.date}>{formatDate(bounty.created_at)}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        sortable: false,
        cell: (bounty) => (
          <div className={queueStyles.actions}>
            {canRetryEscrow(bounty) ? (
              <button
                type="button"
                className={queueStyles.approveBtn}
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

  if (isLoading) {
    return (
      <>
        <MetricGridShimmer />
        <section className={styles.workspaceGrid}>
          <WorkspaceQueueShimmer />
          <HealthPanelShimmer />
        </section>
      </>
    );
  }

  if (error) {
    return (
      <section className={styles.panel}>
        <div className={styles.emptyState}>
          <h2>Dashboard unavailable</h2>
          <p>{error}</p>
          <button type="button" onClick={() => void loadDashboard()}>Retry</button>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* Expiry warning banner */}
      {expiringSoon.length > 0 && !bannerDismissed ? (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            marginBottom: 16,
            background: "color-mix(in srgb, var(--warning, #f59e0b) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--warning, #f59e0b) 40%, transparent)",
            borderRadius: 8,
            fontSize: 14,
            color: "var(--text)",
          }}
        >
          <span style={{ fontSize: 18 }}>⏰</span>
          <span style={{ flex: 1 }}>
            <strong>
              {expiringSoon.length === 1
                ? "1 bounty expires"
                : `${expiringSoon.length} bounties expire`}{" "}
              within 7 days.
            </strong>{" "}
            Extend the deadline or let it expire and contact admin for a refund.
          </span>
          <Link
            href="/dashboard/bounties"
            style={{ fontSize: 13, color: "var(--accent)", textDecoration: "underline", whiteSpace: "nowrap" }}
          >
            View bounties
          </Link>
          <button
            type="button"
            aria-label="Dismiss expiry warning"
            onClick={() => setBannerDismissed(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Metrics row */}
      <section className={styles.metricGrid} aria-label="Dashboard metrics">
        {metrics.map(({ label, value }) => (
          <article className={styles.metricCard} key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      {/* Two-column workspace */}
      <section className={styles.workspaceGrid}>
        {/* Submission review queue */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Queue</span>
              <h2>Submissions awaiting your review</h2>
            </div>
            <button type="button" onClick={() => void loadDashboard()}>Refresh</button>
          </div>
          <div className={styles.queueList}>
            {pendingReviews.length > 0 ? (
              pendingReviews.map((submission) => (
                <article className={styles.queueItem} key={submission.id}>
                  <div>
                    <h3>{submission.bounty?.title || "Submission"}</h3>
                    <p>{submission.content || "No submission notes."}</p>
                    <small>
                      {submission.submitted_at
                        ? `Submitted ${formatDate(submission.submitted_at)}`
                        : "Date unknown"}
                    </small>
                  </div>
                  <Link href="/dashboard/reviews" className={styles.reviewLink}>
                    Review
                  </Link>
                </article>
              ))
            ) : (
              <div className={styles.emptyState}>
                <h2>All clear</h2>
                <p>No submissions waiting for your review.</p>
              </div>
            )}
          </div>
        </div>

        {/* Health panel */}
        <aside className={styles.healthPanel}>
          <span>Operational health</span>
          <strong style={{ fontSize: pendingReviews.length === 0 ? "32px" : "28px" }}>
            {pendingReviews.length === 0 ? "Clear" : `${pendingReviews.length} pending`}
          </strong>
          <div className={styles.progressTrack} aria-hidden="true">
            <i style={{ width: pendingReviews.length === 0 ? "100%" : "40%" }} />
          </div>
          <p>
            Review contributor submissions and recommend them for admin approval to keep your bounty pipeline moving.
          </p>
          <Link href="/dashboard/reviews" className={styles.reviewLink}>
            Go to reviews →
          </Link>
        </aside>
      </section>

      {/* My bounties table using the queueStyles pattern */}
      <section className={styles.tablePanel} style={{ padding: '0', background: 'transparent', boxShadow: 'none', border: 'none' }}>
        <div className={styles.panelHeader} style={{ padding: '0 0 16px 0', borderBottom: 'none' }}>
          <div>
            <span>Bounties</span>
            <h2>My posted bounties</h2>
          </div>
          <Link href="/post-bounty" className={styles.topnavAction}>
            Post bounty
          </Link>
        </div>

        <DataTable
          data={items}
          columns={columns}
          ariaLabel="My Bounties"
          sortCol={sortCol}
          sortDesc={sortDesc}
          onSort={handleSort}
          onRowClick={(bounty) => handleRowClick(bounty.id)}
          emptyState={{
            title: "No bounties yet",
            description: "Post your first bounty to start attracting contributors.",
            action: (
              <Link href="/post-bounty" className={queueStyles.clearFilterBtn} style={{ textDecoration: 'none', display: 'inline-block' }}>
                Post a bounty
              </Link>
            ),
          }}
        />
      </section>

      {/* Bounty Modal */}
      {selectedItem && (
        <div className={queueStyles.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
          <div className={queueStyles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className={queueStyles.modalHeader}>
              <div className={queueStyles.modalHeaderLeft}>
                <StatusPill status={selectedItem.status} />
                <span className={queueStyles.modalAmount}>{formatAda(selectedItem.reward_amount)}</span>
              </div>
              <ModalCloseButton onClose={handleCloseModal} size={20} />
            </div>
            
            <div className={queueStyles.modalBody}>
              <h3 id="modal-title" className={queueStyles.modalTitle}>{selectedItem.title}</h3>
              
              <div className={queueStyles.submitterInfo}>
                <div className={queueStyles.hashGroup} style={{ marginLeft: 0 }}>
                  <span>ID: {shortId(selectedItem.id)}</span>
                  <CopyIconButton
                    text={selectedItem.id}
                    label="Copy bounty ID"
                    className={queueStyles.copyBtn}
                  />
                </div>
              </div>

              <div className={queueStyles.contentSection}>
                <div className={queueStyles.contentBlock}>
                  <div className={queueStyles.contentLabel}>Bounty Description</div>
                  <div className={queueStyles.contentValue}>
                    {selectedItem.description || "No description provided."}
                  </div>
                </div>
                <div className={queueStyles.contentBlock}>
                  <div className={queueStyles.contentLabel}>Category</div>
                  <div className={queueStyles.contentValue}>
                    {selectedItem.custom_type || selectedItem.type || "General"}
                  </div>
                </div>
                <div className={queueStyles.contentBlock}>
                  <div className={queueStyles.contentLabel}>Deadline</div>
                  <div className={queueStyles.contentValue}>
                    {formatDate(selectedItem.deadline)}
                  </div>
                </div>
                {selectedItem.status === "pending_escrow" ? (
                  <div className={queueStyles.contentBlock}>
                    <div className={queueStyles.contentLabel}>Escrow verification</div>
                    <div className={queueStyles.contentValue}>
                      {selectedItem.escrow_tx_hash
                        ? "The wallet transaction is recorded, but escrow has not been confirmed by Blockfrost yet."
                        : "No escrow transaction hash has been recorded for this bounty."}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                      <div>
                        <div className={queueStyles.contentLabel}>Transaction</div>
                        <div className={queueStyles.contentValue} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                          {shortId(selectedItem.escrow_tx_hash)}
                        </div>
                      </div>
                      <div>
                        <div className={queueStyles.contentLabel}>Last checked</div>
                        <div className={queueStyles.contentValue}>{formatDateTime(selectedItem.escrow_last_checked_at)}</div>
                      </div>
                      <div>
                        <div className={queueStyles.contentLabel}>Attempts</div>
                        <div className={queueStyles.contentValue}>{selectedItem.escrow_verification_attempts || 0}</div>
                      </div>
                      <div>
                        <div className={queueStyles.contentLabel}>Submitted</div>
                        <div className={queueStyles.contentValue}>{formatDateTime(selectedItem.escrow_submitted_at)}</div>
                      </div>
                    </div>
                    {selectedItem.escrow_verification_error ? (
                      <div className={queueStyles.contentValue} style={{ marginTop: 12, color: "var(--status-warning-text)" }}>
                        {selectedItem.escrow_verification_error}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className={queueStyles.modalFooter}>
              <ModalNavControls
                itemLabel="bounty"
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
                onPrev={goToPrev}
                onNext={goToNext}
              />

              {canRetryEscrow(selectedItem) ? (
                <button
                  type="button"
                  className={queueStyles.approveBtn}
                  disabled={verifyingBountyId === selectedItem.id}
                  onClick={() => void handleRetryEscrow(selectedItem)}
                >
                  {verifyingBountyId === selectedItem.id ? "Checking escrow..." : "Retry verification"}
                </button>
              ) : (
                <button type="button" className={queueStyles.rejectBtn} disabled>
                  Close Bounty
                </button>
              )}
              <button type="button" className={queueStyles.approveBtn} disabled>
                Edit Details
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
