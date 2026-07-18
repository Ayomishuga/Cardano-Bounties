"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import styles from "@/app/pages/DashboardPage.module.css";
import queueStyles from "@/app/pages/AdminQueue.module.css";

type Submission = {
  id: string;
  bounty_id?: string | null;
  contributor_id?: string | null;
  content?: string | null;
  status: string;
  poster_review_status?: string | null;
  submitted_at?: string | null;
  bounty?: { id: string; title: string; reward_amount?: number | string | null } | null;
};

type Bounty = {
  id: string;
  title: string;
  status: string;
  type?: string | null;
  custom_type?: string | null;
  description?: string | null;
  deadline?: string | null;
  reward_amount?: number | string | null;
  total_funding_amount?: number | string | null;
  escrow_tx_hash?: string | null;
  escrow_address?: string | null;
  escrow_submitted_at?: string | null;
  escrow_confirmed_at?: string | null;
  escrow_last_checked_at?: string | null;
  escrow_verification_attempts?: number | null;
  escrow_verification_error?: string | null;
  created_at?: string | null;
  submissions?: Submission[];
};

type PosterDashboardResponse = {
  metrics: {
    total_bounties: number;
    open_bounties: number;
    pending_submission_reviews: number;
    committed_ada: number;
  };
  queues: {
    bounties?: Bounty[];
    pending_submission_reviews?: Submission[];
  };
};

function formatAda(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(amount)} ADA`;
}

function normalizeStatus(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not checked yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not checked yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function shortId(value: string | null | undefined) {
  if (!value) return "Unknown";
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function getStatusKey(status: string) {
  return status.toLowerCase() === "open" ? "approved" : status.toLowerCase();
}

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
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
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

  const selectedItem = useMemo(() => items.find((b) => b.id === selectedBountyId) || null, [items, selectedBountyId]);
  const selectedIndex = items.findIndex((b) => b.id === selectedBountyId);
  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex !== -1 && selectedIndex < items.length - 1;

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

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedBountyId) {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedBountyId]);

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1500);
    } catch {
      // Ignored
    }
  };

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

  const renderSortIndicator = (col: typeof sortCol) => {
    if (sortCol !== col) return null;
    return sortDesc ? " ↓" : " ↑";
  };

  if (isLoading) {
    return (
      <section className={styles.panel}>
        <div className={styles.emptyState}>
          <h2>Loading dashboard</h2>
          <p>Fetching your bounty and submission data…</p>
        </div>
      </section>
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

        <div className={queueStyles.tableWrap}>
          <table className={queueStyles.table} role="grid" aria-label="My Bounties">
            <thead>
              <tr>
                <th data-sortable="true" onClick={() => handleSort("title")} aria-sort={sortCol === "title" ? (sortDesc ? "descending" : "ascending") : "none"}>
                  <div className={queueStyles.thContent}>Title {renderSortIndicator("title")}</div>
                </th>
                <th data-sortable="true" onClick={() => handleSort("status")} aria-sort={sortCol === "status" ? (sortDesc ? "descending" : "ascending") : "none"}>
                  <div className={queueStyles.thContent}>Status {renderSortIndicator("status")}</div>
                </th>
                <th data-sortable="true" onClick={() => handleSort("reward")} aria-sort={sortCol === "reward" ? (sortDesc ? "descending" : "ascending") : "none"}>
                  <div className={`${queueStyles.thContent} ${queueStyles.right}`}>Reward {renderSortIndicator("reward")}</div>
                </th>
                <th data-sortable="true" onClick={() => handleSort("submissions")} aria-sort={sortCol === "submissions" ? (sortDesc ? "descending" : "ascending") : "none"}>
                  <div className={`${queueStyles.thContent} ${queueStyles.right}`}>Submissions {renderSortIndicator("submissions")}</div>
                </th>
                <th data-sortable="true" onClick={() => handleSort("posted")} aria-sort={sortCol === "posted" ? (sortDesc ? "descending" : "ascending") : "none"}>
                  <div className={queueStyles.thContent}>Posted {renderSortIndicator("posted")}</div>
                </th>
                <th><div className={`${queueStyles.thContent} ${queueStyles.right}`}>Actions</div></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className={queueStyles.emptyState}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                      </svg>
                      <h3>No bounties yet</h3>
                      <p>Post your first bounty to start attracting contributors.</p>
                      <Link href="/post-bounty" className={queueStyles.clearFilterBtn} style={{ textDecoration: 'none', display: 'inline-block' }}>Post a bounty</Link>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((bounty) => (
                  <tr key={bounty.id} onClick={() => handleRowClick(bounty.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(bounty.id); } }}>
                    <td>
                      <span className={queueStyles.bountyTitle} title={bounty.title}>{bounty.title}</span>
                    </td>
                    <td>
                      <span className={queueStyles.statusPill} data-status={getStatusKey(bounty.status)}>
                        {normalizeStatus(bounty.status)}
                      </span>
                    </td>
                    <td>
                      <div className={queueStyles.amount}>{formatAda(bounty.reward_amount)}</div>
                    </td>
                    <td>
                      <div className={queueStyles.amount}>{bounty.submissions?.length ?? 0}</div>
                    </td>
                    <td>
                      <span className={queueStyles.date}>{formatDate(bounty.created_at)}</span>
                    </td>
                    <td>
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
                        <button type="button" aria-label="View bounty" tabIndex={-1} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bounty Modal */}
      {selectedItem && (
        <div className={queueStyles.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
          <div className={queueStyles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className={queueStyles.modalHeader}>
              <div className={queueStyles.modalHeaderLeft}>
                <span className={queueStyles.statusPill} data-status={getStatusKey(selectedItem.status)}>
                  {normalizeStatus(selectedItem.status)}
                </span>
                <span className={queueStyles.modalAmount}>{formatAda(selectedItem.reward_amount)}</span>
              </div>
              <button type="button" className={queueStyles.closeBtn} onClick={handleCloseModal} aria-label="Close modal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className={queueStyles.modalBody}>
              <h3 id="modal-title" className={queueStyles.modalTitle}>{selectedItem.title}</h3>
              
              <div className={queueStyles.submitterInfo}>
                <div className={queueStyles.hashGroup} style={{ marginLeft: 0 }}>
                  <span>ID: {shortId(selectedItem.id)}</span>
                  <button type="button" className={queueStyles.copyBtn} aria-label="Copy bounty ID" aria-live="polite" data-copied={copyStatus === "copied"} onClick={() => void handleCopyHash(selectedItem.id)}>
                    {copyStatus === "copied" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    )}
                  </button>
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
              <div className={queueStyles.navControls}>
                <button type="button" className={queueStyles.navBtn} disabled={!canGoPrev} aria-label="Previous bounty" onClick={() => setSelectedBountyId(items[selectedIndex - 1]?.id || null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button type="button" className={queueStyles.navBtn} disabled={!canGoNext} aria-label="Next bounty" onClick={() => setSelectedBountyId(items[selectedIndex + 1]?.id || null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

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
