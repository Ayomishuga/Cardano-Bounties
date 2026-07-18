"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import styles from "./AdminQueue.module.css";

type Bounty = {
  id: string;
  title: string;
  description?: string | null;
  bounty_instructions?: string | null;
  type?: string | null;
  custom_type?: string | null;
  status?: string | null;
  deadline?: string | null;
  reward_amount?: number | string | null;
  total_funding_amount?: number | string | null;
  payout_type?: string | null;
  max_winners?: number | null;
  prize_structure?: Array<{ rank: number; amount_lovelace: number }> | null;
  submission_count?: number;
  approved_count?: number;
};

type UserProfile = {
  id: string;
  stake_address?: string | null;
  display_name?: string | null;
};

type Submission = {
  id: string;
  bounty_id?: string | null;
  contributor_id?: string | null;
  content?: string | null;
  status: string;
  feedback?: string | null;
  poster_review_status?: string | null;
  poster_feedback?: string | null;
  poster_reviewed_at?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  transaction_hash?: string | null;
  contributor?: UserProfile | null;
  bounties?: Bounty | Bounty[] | null;
  bounty?: Bounty;
};

type DashboardResponse = {
  queues: {
    pending_submissions?: Submission[];
  };
  error?: string;
};

function formatAda(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(amount)} ADA`;
}

function formatLovelaceAsAda(value: number | null | undefined) {
  return formatAda(Number(value || 0) / 1_000_000);
}

function normalizeStatus(value: string | null | undefined) {
  if (!value) return "Pending";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function shortId(value: string | null | undefined) {
  if (!value) return "Unknown";
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.slice(0, 2).toUpperCase();
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

function getSubmissionBounty(submission: Submission) {
  if (submission.bounty) return submission.bounty;
  if (Array.isArray(submission.bounties)) return submission.bounties[0];
  return submission.bounties || null;
}

function getSubmitterHandle(submission: Submission) {
  return submission.contributor?.display_name || shortId(submission.contributor?.stake_address || submission.contributor_id);
}

function getPayoutTypeLabel(value: string | null | undefined) {
  if (value === "equal_split") return "Equal split";
  if (value === "manual_split") return "Manual split";
  return "Single winner";
}

function getPayoutSummary(bounty: Bounty | null) {
  if (!bounty) return "Bounty details unavailable";
  const maxWinners = Number(bounty.max_winners || 1);

  if (bounty.payout_type === "equal_split") {
    return `Pool shared equally across up to ${maxWinners} winner${maxWinners === 1 ? "" : "s"}.`;
  }

  if (bounty.payout_type === "manual_split") {
    return `Admin allocates the pool manually across up to ${maxWinners} winner${maxWinners === 1 ? "" : "s"}.`;
  }

  return "Full reward goes to one approved winner.";
}

function getBountyCategoryLabel(bounty: Bounty | null) {
  if (!bounty) return "Unknown";
  return normalizeStatus(bounty.custom_type || bounty.type || "Unknown");
}

export function AdminSubmissionsPage() {
  const toast = useToast();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [filter, setFilter] = useState("all"); // "all" | "pending" | "approved" | "rejected"
  const [search, setSearch] = useState("");
  
  const [sortCol, setSortCol] = useState<"submitter" | "amount" | "status" | "submitted">("submitted");
  const [sortDesc, setSortDesc] = useState(true);
  
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
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

  const selectedItem = useMemo(() => items.find((s) => s.id === selectedSubmissionId) || null, [items, selectedSubmissionId]);
  const selectedBounty = selectedItem ? getSubmissionBounty(selectedItem) : null;
  const selectedIndex = items.findIndex((s) => s.id === selectedSubmissionId);
  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex !== -1 && selectedIndex < items.length - 1;

  useEffect(() => {
    if (selectedItem) {
      const timeoutId = window.setTimeout(() => {
        setAdminNote(selectedItem.feedback || "");
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [selectedItem]);

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(col);
      setSortDesc(true);
    }
  };

  const handleRowClick = (id: string) => {
    setSelectedSubmissionId(id);
    setContextOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedSubmissionId(null);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedSubmissionId) {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedSubmissionId]);

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1500);
    } catch (e) {
      console.error(e)
    }
  };

  const runAction = async (status: "approved" | "rejected") => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      const response = await authFetch(`/api/submissions/${selectedItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, feedback: adminNote }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Action failed.");
      
      toast.success("Dashboard updated", `Submission ${status}.`);
      
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        const updatedQueue = prev.queues.pending_submissions?.map(sub => 
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

  const renderSortIndicator = (col: typeof sortCol) => {
    if (sortCol !== col) return null;
    return sortDesc ? " ↓" : " ↑";
  };

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.tabs} role="tablist">
          {["all", "pending", "approved", "rejected"].map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={styles.tab}
              data-active={filter === f}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
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
            placeholder="Search submitter or bounty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter submissions"
          />
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table} role="grid" aria-label="Submissions">
          <thead>
            <tr>
              <th data-sortable="true" onClick={() => handleSort("submitter")} aria-sort={sortCol === "submitter" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Submitter {renderSortIndicator("submitter")}</div>
              </th>
              <th>Bounty</th>
              <th data-sortable="true" onClick={() => handleSort("amount")} aria-sort={sortCol === "amount" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>Amount {renderSortIndicator("amount")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("status")} aria-sort={sortCol === "status" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Status {renderSortIndicator("status")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("submitted")} aria-sort={sortCol === "submitted" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Submitted {renderSortIndicator("submitted")}</div>
              </th>
              <th><div className={`${styles.thContent} ${styles.right}`}>Actions</div></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} aria-hidden="true">
                  <td><div className={styles.shimmer} style={{ width: '120px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '180px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '80px', marginLeft: 'auto' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '60px', borderRadius: '999px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '70px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '24px', marginLeft: 'auto' }} /></td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={6}>
                  <div className={styles.emptyState}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <h3>Could not load submissions</h3>
                    <p>{error}</p>
                    <button type="button" className={styles.clearFilterBtn} onClick={() => void loadDashboard()}>Retry</button>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className={styles.emptyState}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                    {search || filter !== "all" ? (
                      <>
                        <h3>No matching submissions</h3>
                        <p>No submissions match your current filters.</p>
                        <button type="button" className={styles.clearFilterBtn} onClick={() => { setFilter("all"); setSearch(""); }}>Clear filters</button>
                      </>
                    ) : (
                      <>
                        <h3>No submissions yet</h3>
                        <p>There are no submissions in the queue.</p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((submission) => {
                const handle = getSubmitterHandle(submission);
                const bounty = getSubmissionBounty(submission);
                
                return (
                  <tr key={submission.id} onClick={() => handleRowClick(submission.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(submission.id); } }}>
                    <td>
                      <div className={styles.submitter}>
                        <div className={styles.avatar} aria-hidden="true">{getInitials(handle)}</div>
                        <span className={styles.handle} title={handle}>{handle}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.bountyTitle} title={bounty?.title}>{bounty?.title || "Unknown Bounty"}</span>
                    </td>
                    <td>
                      <div className={styles.amount}>{formatAda(bounty?.reward_amount)}</div>
                    </td>
                    <td>
                      <span className={styles.statusPill} data-status={submission.status.toLowerCase()}>
                        {normalizeStatus(submission.status)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.date} title={submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : undefined}>
                        {formatRelativeTime(submission.submitted_at)}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button type="button" aria-label="View submission" tabIndex={-1} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}>
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

      {selectedItem && (
        <div className={styles.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderLeft}>
                <span className={styles.statusPill} data-status={selectedItem.status.toLowerCase()}>
                  {normalizeStatus(selectedItem.status)}
                </span>
                <span className={styles.modalAmount}>{formatAda(selectedBounty?.reward_amount)}</span>
                <span className={styles.modalMetaPill}>{getPayoutTypeLabel(selectedBounty?.payout_type)}</span>
                {(() => {
                  const b = selectedBounty;
                  const total = b?.submission_count ?? 0;
                  if (!total) return null;
                  return (
                    <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {total} submission{total !== 1 ? 's' : ''}
                      {' · '}<span style={{ color: 'var(--status-success-text)' }}>{b?.approved_count ?? 0} approved</span>
                    </span>
                  );
                })()}
              </div>
              <button type="button" className={styles.closeBtn} onClick={handleCloseModal} aria-label="Close modal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <h3 id="modal-title" className={styles.modalTitle}>{selectedBounty?.title || "Unknown Bounty"}</h3>
              
              <div className={styles.submitterInfo}>
                <div className={styles.avatar} aria-hidden="true">{getInitials(getSubmitterHandle(selectedItem))}</div>
                <span className={styles.handle} style={{ fontSize: '14px' }}>{getSubmitterHandle(selectedItem)}</span>
                
                <div className={styles.hashGroup}>
                  <span>ID: {shortId(selectedItem.id)}</span>
                  <button type="button" className={styles.copyBtn} aria-label="Copy submission hash" aria-live="polite" data-copied={copyStatus === "copied"} onClick={() => void handleCopyHash(selectedItem.id)}>
                    {copyStatus === "copied" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <section className={styles.contextPanel} aria-label="Bounty context for submission review">
                <button
                  type="button"
                  className={styles.contextHeader}
                  onClick={() => setContextOpen((open) => !open)}
                  aria-expanded={contextOpen}
                >
                  <span>Bounty context and review criteria</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={styles.contextChevron}
                    data-open={contextOpen}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {contextOpen && (
                  <div className={styles.contextBody}>
                    <div className={styles.contextMetaGrid}>
                      <div>
                        <span>Category</span>
                        <strong>{getBountyCategoryLabel(selectedBounty)}</strong>
                      </div>
                      <div>
                        <span>Bounty status</span>
                        <strong>{normalizeStatus(selectedBounty?.status || "Unknown")}</strong>
                      </div>
                      <div>
                        <span>Deadline</span>
                        <strong>{formatDate(selectedBounty?.deadline)}</strong>
                      </div>
                      <div>
                        <span>Payout rule</span>
                        <strong>{getPayoutTypeLabel(selectedBounty?.payout_type)}</strong>
                      </div>
                    </div>

                    <div className={styles.contextBlock}>
                      <div className={styles.contentLabel}>Bounty brief</div>
                      <div className={`${styles.contentValue} ${!selectedBounty?.description ? styles.missingValue : ""}`}>
                        {selectedBounty?.description || "No bounty description was provided."}
                      </div>
                    </div>

                    <div className={styles.contextBlock} data-emphasis="true">
                      <div className={styles.contentLabel}>Acceptance criteria / instructions</div>
                      <div className={`${styles.contentValue} ${!selectedBounty?.bounty_instructions ? styles.missingValue : ""}`}>
                        {selectedBounty?.bounty_instructions || "No acceptance criteria were provided. Use the submission evidence and poster recommendation with extra caution."}
                      </div>
                    </div>

                    <div className={styles.payoutReviewBox}>
                      <div>
                        <span>Reward pool</span>
                        <strong>{formatAda(selectedBounty?.reward_amount)}</strong>
                      </div>
                      <div>
                        <span>Winner capacity</span>
                        <strong>{selectedBounty?.max_winners ?? 1}</strong>
                      </div>
                      <p>{getPayoutSummary(selectedBounty)}</p>
                    </div>

                    {selectedBounty?.payout_type === "manual_split" && selectedBounty.prize_structure && selectedBounty.prize_structure.length > 0 ? (
                      <div className={styles.prizeList} aria-label="Manual prize structure">
                        {[...selectedBounty.prize_structure].sort((a, b) => a.rank - b.rank).map((prize) => (
                          <span key={prize.rank}>
                            Rank {prize.rank}: {formatLovelaceAsAda(prize.amount_lovelace)}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {selectedBounty?.id ? (
                      <a className={styles.contextLink} href={`/bounties/${selectedBounty.id}`} target="_blank" rel="noopener noreferrer">
                        Open full bounty details
                      </a>
                    ) : null}
                  </div>
                )}
              </section>

              <div className={styles.contentSection}>
                <div className={styles.contentBlock} style={{ display: 'flex', gap: 0 }}>
                  <div style={{ flex: 1 }}>
                    <div className={styles.contentLabel}>Submitted</div>
                    <div className={styles.contentValue}>{formatDateTime(selectedItem.submitted_at)}</div>
                  </div>
                  {(() => {
                    const b = selectedBounty;
                    if (!b) return null;
                    return (
                      <div style={{ flex: 1, borderLeft: '1px solid var(--line)', paddingLeft: 16 }}>
                        <div className={styles.contentLabel}>Competing submissions</div>
                        <div className={styles.contentValue}>
                          {b.submission_count} total
                          {(b.approved_count ?? 0) > 0 && <span style={{ marginLeft: 8, color: 'var(--status-success-text)' }}>· {b.approved_count} approved</span>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel}>Submission content</div>
                  <div className={styles.contentValue}>
                    {selectedItem.content?.startsWith("http") ? (
                      <a href={selectedItem.content} target="_blank" rel="noopener noreferrer" className={styles.contentLink}>
                        {selectedItem.content}
                      </a>
                    ) : (
                      selectedItem.content || "No submission content provided."
                    )}
                  </div>
                </div>
                <div className={styles.contentBlock}>
                  <div className={styles.posterReviewHeader}>
                    <div>
                      <div className={styles.contentLabel}>Poster recommendation</div>
                      <div className={styles.contentValue}>{normalizeStatus(selectedItem.poster_review_status || "Pending")}</div>
                    </div>
                    <span>{formatDateTime(selectedItem.poster_reviewed_at)}</span>
                  </div>
                  <div className={`${styles.contentValue} ${!selectedItem.poster_feedback ? styles.missingValue : ""}`}>
                    {selectedItem.poster_feedback || "No poster feedback was provided."}
                  </div>
                </div>
              </div>

              <div className={styles.adminNoteSection}>
                <label className={styles.contentLabel} htmlFor="admin-note-modal">
                  Feedback to contributor
                  <span style={{ fontWeight: 400, fontSize: 11, textTransform: 'none', marginLeft: 6, color: 'var(--muted)' }}>(sent in notification on reject)</span>
                </label>
                <textarea
                  id="admin-note-modal"
                  className={styles.adminNoteTextarea}
                  placeholder="Add an internal note for this review. Will be saved when you approve or reject."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.navControls}>
                <button type="button" className={styles.navBtn} disabled={!canGoPrev} aria-label="Previous submission" onClick={() => setSelectedSubmissionId(items[selectedIndex - 1]?.id || null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button type="button" className={styles.navBtn} disabled={!canGoNext} aria-label="Next submission" onClick={() => setSelectedSubmissionId(items[selectedIndex + 1]?.id || null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

              {selectedItem.status.toLowerCase() !== "pending" ? (
                <div className={styles.resolutionState}>
                  {normalizeStatus(selectedItem.status)} 
                  {selectedItem.status.toLowerCase() === "approved" ? " for payout" : ""}
                </div>
              ) : (
                <>
                  <button type="button" className={styles.rejectBtn} disabled={isSubmitting} onClick={() => void runAction("rejected")}>
                    {isSubmitting ? <div className={styles.spinner} /> : "Reject"}
                  </button>
                  <button type="button" className={styles.approveBtn} disabled={isSubmitting} onClick={() => void runAction("approved")}>
                    {isSubmitting ? <div className={styles.spinner} /> : "Approve"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
