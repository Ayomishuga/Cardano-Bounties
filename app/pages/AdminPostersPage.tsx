"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import styles from "./AdminQueue.module.css";

type UserProfile = {
  id: string;
  stake_address?: string | null;
  display_name?: string | null;
};

type Bounty = {
  id: string;
  title: string;
  status: string;
  reward_amount?: number | string | null;
  created_by?: string | null;
  created_at?: string | null;
  poster?: UserProfile | null;
};

type DashboardResponse = {
  queues: {
    bounties?: Bounty[];
  };
  error?: string;
};

type PosterStats = {
  key: string;
  wallet: string;
  displayName: string;
  bounties: Bounty[];
  totalBounties: number;
  totalAda: number;
  approvalRate: number;
  activeBounties: number;
  joined: string;
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

export function AdminPostersPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"wallet" | "total" | "ada" | "approval" | "active" | "joined">("total");
  const [sortDesc, setSortDesc] = useState(true);
  
  const [selectedPosterKey, setSelectedPosterKey] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/dashboard/admin", { headers: { Accept: "application/json" } });
      const payload = (await response.json()) as DashboardResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load posters.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load posters.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const items = useMemo(() => {
    const bounties = data?.queues.bounties || [];
    const postersMap = new Map<string, { wallet: string; displayName: string; bounties: Bounty[] }>();
    
    bounties.forEach((bounty) => {
      const key = bounty.created_by || bounty.poster?.stake_address || "unknown";
      const existing = postersMap.get(key) || { 
        wallet: bounty.poster?.stake_address || key,
        displayName: bounty.poster?.display_name || "",
        bounties: [] 
      };
      existing.bounties.push(bounty);
      postersMap.set(key, existing);
    });

    let list: PosterStats[] = [...postersMap.entries()].map(([key, poster]) => {
      const approvedCount = poster.bounties.filter((b) => ["open", "completed"].includes(b.status)).length;
      const totalAda = poster.bounties.reduce((sum, b) => sum + Number(b.reward_amount || 0), 0);
      const activeCount = poster.bounties.filter((b) => b.status === "open").length;
      
      // Sort bounties by date to find oldest (joined)
      const sortedBounties = [...poster.bounties].sort((a, b) => {
        return (a.created_at ? new Date(a.created_at).getTime() : 0) - (b.created_at ? new Date(b.created_at).getTime() : 0);
      });

      return {
        key,
        wallet: poster.wallet,
        displayName: poster.displayName,
        bounties: poster.bounties,
        totalBounties: poster.bounties.length,
        totalAda,
        approvalRate: Math.round((approvedCount / Math.max(poster.bounties.length, 1)) * 100),
        activeBounties: activeCount,
        joined: sortedBounties[0]?.created_at || "",
      };
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => {
        return p.wallet.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q);
      });
    }
    
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "wallet":
          const nameA = a.displayName || a.wallet;
          const nameB = b.displayName || b.wallet;
          cmp = nameA.localeCompare(nameB);
          break;
        case "total":
          cmp = a.totalBounties - b.totalBounties;
          break;
        case "ada":
          cmp = a.totalAda - b.totalAda;
          break;
        case "approval":
          cmp = a.approvalRate - b.approvalRate;
          break;
        case "active":
          cmp = a.activeBounties - b.activeBounties;
          break;
        case "joined":
          const aDate = a.joined ? new Date(a.joined).getTime() : 0;
          const bDate = b.joined ? new Date(b.joined).getTime() : 0;
          cmp = aDate - bDate;
          break;
      }
      return sortDesc ? -cmp : cmp;
    });

    return list;
  }, [data, search, sortCol, sortDesc]);

  const selectedItem = useMemo(() => items.find((p) => p.key === selectedPosterKey) || null, [items, selectedPosterKey]);
  const selectedIndex = items.findIndex((p) => p.key === selectedPosterKey);
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
    setSelectedPosterKey(key);
  };

  const handleCloseModal = () => {
    setSelectedPosterKey(null);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedPosterKey) {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedPosterKey]);

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
            placeholder="Search poster wallet or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter posters"
          />
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table} role="grid" aria-label="Posters">
          <thead>
            <tr>
              <th data-sortable="true" onClick={() => handleSort("wallet")} aria-sort={sortCol === "wallet" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Wallet {renderSortIndicator("wallet")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("total")} aria-sort={sortCol === "total" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>Total Bounties {renderSortIndicator("total")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("ada")} aria-sort={sortCol === "ada" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>Total ADA {renderSortIndicator("ada")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("approval")} aria-sort={sortCol === "approval" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>Approval Rate {renderSortIndicator("approval")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("active")} aria-sort={sortCol === "active" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>Active Bounties {renderSortIndicator("active")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("joined")} aria-sort={sortCol === "joined" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Joined {renderSortIndicator("joined")}</div>
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
                  <td><div className={styles.shimmer} style={{ width: '80px', marginLeft: 'auto' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '50px', marginLeft: 'auto' }} /></td>
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
                    <h3>Couldn't load posters</h3>
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
                        <h3>No matching posters</h3>
                        <p>No posters match your search.</p>
                        <button type="button" className={styles.clearFilterBtn} onClick={() => setSearch("")}>Clear search</button>
                      </>
                    ) : (
                      <>
                        <h3>No posters found</h3>
                        <p>There are no posters in the system yet.</p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((poster) => {
                const handle = poster.displayName || shortId(poster.wallet);
                
                return (
                  <tr key={poster.key} onClick={() => handleRowClick(poster.key)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(poster.key); } }}>
                    <td>
                      <div className={styles.submitter}>
                        <div className={styles.avatar} aria-hidden="true">{getInitials(handle)}</div>
                        <span className={styles.handle} title={poster.wallet}>{handle}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.amount}>{poster.totalBounties}</div>
                    </td>
                    <td>
                      <div className={styles.amount}>{formatAda(poster.totalAda)}</div>
                    </td>
                    <td>
                      <div className={styles.amount}>{poster.approvalRate}%</div>
                    </td>
                    <td>
                      <div className={styles.amount}>{poster.activeBounties}</div>
                    </td>
                    <td>
                      <span className={styles.date}>{formatDate(poster.joined)}</span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button type="button" aria-label="View poster" tabIndex={-1} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}>
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
                  {selectedItem.approvalRate}% Approval
                </span>
                <span className={styles.modalAmount}>{formatAda(selectedItem.totalAda)}</span>
              </div>
              <button type="button" className={styles.closeBtn} onClick={handleCloseModal} aria-label="Close modal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <h3 id="modal-title" className={styles.modalTitle}>{selectedItem.displayName || "Poster Profile"}</h3>
              
              <div className={styles.submitterInfo}>
                <div className={styles.avatar} aria-hidden="true">{getInitials(selectedItem.displayName || shortId(selectedItem.wallet))}</div>
                <span className={styles.handle} style={{ fontSize: '14px' }}>{shortId(selectedItem.wallet)}</span>
                
                <div className={styles.hashGroup}>
                  <button type="button" className={styles.copyBtn} aria-label="Copy poster address" aria-live="polite" data-copied={copyStatus === "copied"} onClick={() => void handleCopyHash(selectedItem.wallet)}>
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
                  <div className={styles.contentLabel}>Recent Bounties</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedItem.bounties.slice(0, 5).map((b) => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }}>{b.title}</span>
                        <span className={styles.statusPill} data-status={b.status.toLowerCase() === "open" ? "approved" : b.status.toLowerCase()}>{normalizeStatus(b.status)}</span>
                      </div>
                    ))}
                    {selectedItem.bounties.length > 5 && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '4px' }}>
                        + {selectedItem.bounties.length - 5} more bounties
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.navControls}>
                <button type="button" className={styles.navBtn} disabled={!canGoPrev} aria-label="Previous poster" onClick={() => setSelectedPosterKey(items[selectedIndex - 1]?.key || null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button type="button" className={styles.navBtn} disabled={!canGoNext} aria-label="Next poster" onClick={() => setSelectedPosterKey(items[selectedIndex + 1]?.key || null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

              <button type="button" className={styles.rejectBtn} disabled>
                Suspend Account
              </button>
              <button type="button" className={styles.approveBtn} disabled>
                Message Poster
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
