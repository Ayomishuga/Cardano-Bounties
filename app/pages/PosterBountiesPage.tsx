"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import styles from "./AdminQueue.module.css";
import { AdminTableBodyShimmer } from "@/components/dashboard/ShimmerLoaders";

type Submission = {
  id: string;
  bounty_id?: string | null;
  contributor_id?: string | null;
  content?: string | null;
  status: string;
  feedback?: string | null;
  poster_review_status?: string | null;
  poster_feedback?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  paid_at?: string | null;
  transaction_hash?: string | null;
};

type Bounty = {
  id: string;
  title: string;
  status: string;
  type?: string | null;
  custom_type?: string | null;
  description?: string | null;
  bounty_instructions?: string | null;
  deadline?: string | null;
  deadline_extended_count?: number | null;
  project_name?: string | null;
  project_logo_url?: string | null;
  reward_amount?: number | string | null;
  platform_fee_amount?: number | string | null;
  total_funding_amount?: number | string | null;
  payout_type?: string | null;
  max_winners?: number | null;
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
  metrics?: Record<string, number>;
  queues?: {
    bounties?: Bounty[];
  };
  error?: string;
};

function formatAda(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(amount)} ADA`;
}

function normalizeStatus(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortId(value: string | null | undefined) {
  if (!value) return "Unknown";
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getBountyTypeLabel(bounty: Bounty) {
  return normalizeStatus(bounty.custom_type || bounty.type || "General");
}

function getStatusKey(status: string) {
  return status.toLowerCase() === "open" ? "approved" : status.toLowerCase();
}

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
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
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

  const selectedItem = useMemo(() => items.find((bounty) => bounty.id === selectedBountyId) || null, [items, selectedBountyId]);
  const selectedIndex = items.findIndex((bounty) => bounty.id === selectedBountyId);
  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex !== -1 && selectedIndex < items.length - 1;
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

  function renderSortIndicator(col: typeof sortCol) {
    if (sortCol !== col) return null;
    return sortDesc ? " ↓" : " ↑";
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1500);
    } catch (err) {
      console.error(err);
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

      <div className={styles.tableWrap}>
        <table className={styles.table} role="grid" aria-label="My bounties">
          <thead>
            <tr>
              <th data-sortable="true" onClick={() => handleSort("title")} aria-sort={sortCol === "title" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Bounty {renderSortIndicator("title")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("status")} aria-sort={sortCol === "status" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Status {renderSortIndicator("status")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("reward")} aria-sort={sortCol === "reward" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>Reward {renderSortIndicator("reward")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("submissions")} aria-sort={sortCol === "submissions" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>Submissions {renderSortIndicator("submissions")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("posted")} aria-sort={sortCol === "posted" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Posted {renderSortIndicator("posted")}</div>
              </th>
              <th><div className={`${styles.thContent} ${styles.right}`}>Actions</div></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <AdminTableBodyShimmer columns={7} rows={5} />
            ) : error ? (
              <tr>
                <td colSpan={6}>
                  <div className={styles.emptyState}>
                    <h3>Could not load bounties</h3>
                    <p>{error}</p>
                    <button type="button" className={styles.clearFilterBtn} onClick={() => void loadBounties()}>Retry</button>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className={styles.emptyState}>
                    <h3>{search || filter !== "all" ? "No matching bounties" : "No posted bounties yet"}</h3>
                    <p>{search || filter !== "all" ? "No bounties match your current filters." : "Post a bounty to start receiving submissions."}</p>
                    {search || filter !== "all" ? (
                      <button type="button" className={styles.clearFilterBtn} onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button>
                    ) : (
                      <Link href="/post-bounty" className={styles.clearFilterBtn}>Post bounty</Link>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((bounty) => {
                const counts = getReviewCounts(bounty);

                return (
                  <tr
                    key={bounty.id}
                    onClick={() => setSelectedBountyId(bounty.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedBountyId(bounty.id);
                      }
                    }}
                  >
                    <td>
                      <span className={styles.bountyTitle} title={bounty.title}>{bounty.title}</span>
                      <div className={styles.date}>{getBountyTypeLabel(bounty)}</div>
                    </td>
                    <td>
                      <span className={styles.statusPill} data-status={getStatusKey(bounty.status)}>
                        {normalizeStatus(bounty.status)}
                      </span>
                    </td>
                    <td><div className={styles.amount}>{formatAda(bounty.reward_amount)}</div></td>
                    <td><div className={styles.amount}>{counts.total}</div></td>
                    <td>
                      <span className={styles.date} title={bounty.created_at ? new Date(bounty.created_at).toLocaleString() : undefined}>
                        {formatRelativeTime(bounty.created_at)}
                      </span>
                    </td>
                    <td>
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
                        <button type="button" aria-label="View bounty" tabIndex={-1} style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedItem ? (
        <PosterBountyModal
          bounty={selectedItem}
          canGoNext={canGoNext}
          canGoPrev={canGoPrev}
          copyStatus={copyStatus}
          isExtending={extendingBountyId === selectedItem.id}
          isVerifying={verifyingBountyId === selectedItem.id}
          onClose={() => setSelectedBountyId(null)}
          onCopy={handleCopy}
          onExtendDeadline={handleExtendDeadline}
          onNext={() => setSelectedBountyId(items[selectedIndex + 1]?.id || null)}
          onPrev={() => setSelectedBountyId(items[selectedIndex - 1]?.id || null)}
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
  copyStatus,
  isExtending,
  isVerifying,
  onClose,
  onCopy,
  onExtendDeadline,
  onNext,
  onPrev,
  onRetryEscrow,
}: {
  bounty: Bounty;
  canGoNext: boolean;
  canGoPrev: boolean;
  copyStatus: "idle" | "copied";
  isExtending: boolean;
  isVerifying: boolean;
  onClose: () => void;
  onCopy: (value: string) => void;
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
            <span className={styles.statusPill} data-status={getStatusKey(bounty.status)}>
              {normalizeStatus(bounty.status)}
            </span>
            <span className={styles.modalAmount}>{formatAda(bounty.reward_amount)}</span>
            <span className={styles.modalMetaPill}>{normalizeStatus(bounty.payout_type || "single")}</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.modalBody}>
          <h3 id="poster-bounty-modal-title" className={styles.modalTitle}>{bounty.title}</h3>

          <div className={styles.submitterInfo}>
            <div className={styles.avatar} aria-hidden="true">{getBountyTypeLabel(bounty).slice(0, 2).toUpperCase()}</div>
            <span className={styles.handle} style={{ fontSize: "14px" }}>{bounty.project_name || "Independent bounty"}</span>
            <div className={styles.hashGroup}>
              <span>ID: {shortId(bounty.id)}</span>
              <button type="button" className={styles.copyBtn} aria-label="Copy bounty ID" aria-live="polite" data-copied={copyStatus === "copied"} onClick={() => void onCopy(bounty.id)}>
                {copyStatus === "copied" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                )}
              </button>
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
                  <strong>{getBountyTypeLabel(bounty)}</strong>
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
          <div className={styles.navControls}>
            <button type="button" className={styles.navBtn} disabled={!canGoPrev} aria-label="Previous bounty" onClick={onPrev}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button type="button" className={styles.navBtn} disabled={!canGoNext} aria-label="Next bounty" onClick={onNext}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
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
