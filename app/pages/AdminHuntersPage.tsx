"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import styles from "./AdminQueue.module.css";

type Bounty = {
  id: string;
  title: string;
  reward_amount?: number | string | null;
};

type Submission = {
  id: string;
  contributor_id?: string | null;
  status: string;
  submitted_at?: string | null;
  bounties?: Bounty | Bounty[] | null;
  bounty?: Bounty;
};

type DashboardResponse = {
  queues: {
    bounties?: { submissions?: Submission[] }[];
    pending_submissions?: Submission[];
    approved_payouts?: Submission[];
  };
  error?: string;
};

type HunterStats = {
  key: string;
  wallet: string;
  submissions: Submission[];
  totalSubmissions: number;
  accepted: number;
  adaEarned: number;
  activeSubmissions: number;
  lastActive: string;
};

function formatAda(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(amount)} ADA`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function normalizeStatus(value: string | null | undefined) {
  if (!value) return "Pending";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function getSubmissionBounty(submission: Submission) {
  if (submission.bounty) return submission.bounty;
  if (Array.isArray(submission.bounties)) return submission.bounties[0];
  return submission.bounties || null;
}

export function AdminHuntersPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"wallet" | "total" | "accepted" | "ada" | "active" | "last">("total");
  const [sortDesc, setSortDesc] = useState(true);
  
  const [selectedHunterKey, setSelectedHunterKey] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/dashboard/admin", { headers: { Accept: "application/json" } });
      const payload = (await response.json()) as DashboardResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load hunters.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load hunters.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const items = useMemo(() => {
    const bounties = data?.queues.bounties || [];
    const pending = data?.queues.pending_submissions || [];
    const payouts = data?.queues.approved_payouts || [];
    
    const allSubmissions = [
      ...pending,
      ...payouts,
      ...bounties.flatMap((b) => b.submissions || [])
    ];

    const huntersMap = new Map<string, Submission[]>();
    
    allSubmissions.forEach((sub) => {
      const key = sub.contributor_id || "unknown";
      huntersMap.set(key, [...(huntersMap.get(key) || []), sub]);
    });

    let list: HunterStats[] = [...huntersMap.entries()].map(([key, submissions]) => {
      const accepted = submissions.filter((s) => ["approved", "paid"].includes(s.status));
      const earned = accepted.reduce((sum, s) => sum + Number(getSubmissionBounty(s)?.reward_amount || 0), 0);
      const activeCount = submissions.filter((s) => s.status === "pending").length;
      
      const lastActive = submissions
        .map((s) => s.submitted_at)
        .filter(Boolean)
        .sort()
        .at(-1) || "";

      return {
        key,
        wallet: key,
        submissions,
        totalSubmissions: submissions.length,
        accepted: accepted.length,
        adaEarned: earned,
        activeSubmissions: activeCount,
        lastActive,
      };
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((h) => h.wallet.toLowerCase().includes(q));
    }
    
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "wallet":
          cmp = a.wallet.localeCompare(b.wallet);
          break;
        case "total":
          cmp = a.totalSubmissions - b.totalSubmissions;
          break;
        case "accepted":
          cmp = a.accepted - b.accepted;
          break;
        case "ada":
          cmp = a.adaEarned - b.adaEarned;
          break;
        case "active":
          cmp = a.activeSubmissions - b.activeSubmissions;
          break;
        case "last":
          const aDate = a.lastActive ? new Date(a.lastActive).getTime() : 0;
          const bDate = b.lastActive ? new Date(b.lastActive).getTime() : 0;
          cmp = aDate - bDate;
          break;
      }
      return sortDesc ? -cmp : cmp;
    });

    return list;
  }, [data, search, sortCol, sortDesc]);

  const selectedItem = useMemo(() => items.find((h) => h.key === selectedHunterKey) || null, [items, selectedHunterKey]);
  const selectedIndex = items.findIndex((h) => h.key === selectedHunterKey);
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

  const handleRowClick = (key: string) => {
    setSelectedHunterKey(key);
  };

  const handleCloseModal = () => {
    setSelectedHunterKey(null);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedHunterKey) {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedHunterKey]);

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1500);
    } catch (e) {
      // Ignored
    }
  };

  const renderSortIndicator = (col: typeof sortCol) => {
    if (sortCol !== col) return null;
    return sortDesc ? " ↓" : " ↑";
  };

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.search} style={{ width: '100%', maxWidth: '400px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search hunter wallet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter hunters"
          />
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table} role="grid" aria-label="Hunters">
          <thead>
            <tr>
              <th data-sortable="true" onClick={() => handleSort("wallet")} aria-sort={sortCol === "wallet" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Wallet {renderSortIndicator("wallet")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("total")} aria-sort={sortCol === "total" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>Total Submissions {renderSortIndicator("total")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("accepted")} aria-sort={sortCol === "accepted" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>Accepted {renderSortIndicator("accepted")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("ada")} aria-sort={sortCol === "ada" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>ADA Earned {renderSortIndicator("ada")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("active")} aria-sort={sortCol === "active" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>Active Submissions {renderSortIndicator("active")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("last")} aria-sort={sortCol === "last" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Last Active {renderSortIndicator("last")}</div>
              </th>
              <th><div className={`${styles.thContent} ${styles.right}`}>Actions</div></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} aria-hidden="true">
                  <td><div className={styles.shimmer} style={{ width: '120px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '40px', marginLeft: 'auto' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '40px', marginLeft: 'auto' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '80px', marginLeft: 'auto' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '40px', marginLeft: 'auto' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '70px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '24px', marginLeft: 'auto' }} /></td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={7}>
                  <div className={styles.emptyState}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <h3>Couldn't load hunters</h3>
                    <p>{error}</p>
                    <button type="button" className={styles.clearFilterBtn} onClick={() => void loadDashboard()}>Retry</button>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className={styles.emptyState}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                    {search ? (
                      <>
                        <h3>No matching hunters</h3>
                        <p>No hunters match your search.</p>
                        <button type="button" className={styles.clearFilterBtn} onClick={() => setSearch("")}>Clear search</button>
                      </>
                    ) : (
                      <>
                        <h3>No hunters found</h3>
                        <p>There are no hunters in the system yet.</p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((hunter) => {
                return (
                  <tr key={hunter.key} onClick={() => handleRowClick(hunter.key)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(hunter.key); } }}>
                    <td>
                      <div className={styles.submitter}>
                        <div className={styles.avatar} aria-hidden="true">{getInitials(hunter.wallet)}</div>
                        <span className={styles.handle} title={hunter.wallet}>{shortId(hunter.wallet)}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.amount}>{hunter.totalSubmissions}</div>
                    </td>
                    <td>
                      <div className={styles.amount}>{hunter.accepted}</div>
                    </td>
                    <td>
                      <div className={styles.amount}>{formatAda(hunter.adaEarned)}</div>
                    </td>
                    <td>
                      <div className={styles.amount}>{hunter.activeSubmissions}</div>
                    </td>
                    <td>
                      <span className={styles.date}>{formatDate(hunter.lastActive)}</span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button type="button" aria-label="View hunter" tabIndex={-1} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}>
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
                <span className={styles.statusPill} data-status="approved">
                  {selectedItem.accepted} Accepted
                </span>
                <span className={styles.modalAmount}>{formatAda(selectedItem.adaEarned)}</span>
              </div>
              <button type="button" className={styles.closeBtn} onClick={handleCloseModal} aria-label="Close modal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <h3 id="modal-title" className={styles.modalTitle}>Hunter Profile</h3>
              
              <div className={styles.submitterInfo}>
                <div className={styles.avatar} aria-hidden="true">{getInitials(selectedItem.wallet)}</div>
                <span className={styles.handle} style={{ fontSize: '14px' }}>{shortId(selectedItem.wallet)}</span>
                
                <div className={styles.hashGroup}>
                  <button type="button" className={styles.copyBtn} aria-label="Copy hunter address" aria-live="polite" data-copied={copyStatus === "copied"} onClick={() => void handleCopyHash(selectedItem.wallet)}>
                    {copyStatus === "copied" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className={styles.contentSection}>
                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel}>Recent Submissions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedItem.submissions.slice(0, 5).map((s) => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }}>
                          {getSubmissionBounty(s)?.title || "Unknown Bounty"}
                        </span>
                        <span className={styles.statusPill} data-status={s.status.toLowerCase()}>{normalizeStatus(s.status)}</span>
                      </div>
                    ))}
                    {selectedItem.submissions.length > 5 && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '4px' }}>
                        + {selectedItem.submissions.length - 5} more submissions
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.navControls}>
                <button type="button" className={styles.navBtn} disabled={!canGoPrev} aria-label="Previous hunter" onClick={() => setSelectedHunterKey(items[selectedIndex - 1]?.key || null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button type="button" className={styles.navBtn} disabled={!canGoNext} aria-label="Next hunter" onClick={() => setSelectedHunterKey(items[selectedIndex + 1]?.key || null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

              <button type="button" className={styles.rejectBtn} disabled>
                Suspend Account
              </button>
              <button type="button" className={styles.approveBtn} disabled>
                Message Hunter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
