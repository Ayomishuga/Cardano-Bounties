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
  description?: string | null;
  type?: string | null;
  custom_type?: string | null;
  status: string;
  reward_amount?: number | string | null;
  escrow_tx_hash?: string | null;
  refund_tx_hash?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  poster?: UserProfile | null;
};

type DashboardResponse = {
  queues: {
    refund_candidates?: Bounty[];
  };
  error?: string;
};

function formatAda(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(amount)} ADA`;
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

function getBountyPoster(bounty: Bounty) {
  return bounty.poster?.display_name || shortId(bounty.poster?.stake_address || bounty.created_by);
}

export function AdminRefundsPage() {
  const toast = useToast();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [filter, setFilter] = useState("all"); 
  const [search, setSearch] = useState("");
  
  const [sortCol, setSortCol] = useState<"poster" | "title" | "amount" | "status" | "created">("created");
  const [sortDesc, setSortDesc] = useState(true);
  
  const [selectedBountyId, setSelectedBountyId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/dashboard/admin", { headers: { Accept: "application/json" } });
      const payload = (await response.json()) as DashboardResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load refunds.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load refunds.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const items = useMemo(() => {
    let list = data?.queues.refund_candidates || [];
    
    if (filter !== "all") {
      list = list.filter((b) => b.status.toLowerCase() === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) => {
        const handle = getBountyPoster(b).toLowerCase();
        const bountyTitle = b.title.toLowerCase();
        return handle.includes(q) || bountyTitle.includes(q);
      });
    }
    
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "poster":
          cmp = getBountyPoster(a).localeCompare(getBountyPoster(b));
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "amount":
          const aAmount = Number(a.reward_amount || 0);
          const bAmount = Number(b.reward_amount || 0);
          cmp = aAmount - bAmount;
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "created":
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
          cmp = aDate - bDate;
          break;
      }
      return sortDesc ? -cmp : cmp;
    });

    return list;
  }, [data, filter, search, sortCol, sortDesc]);

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
    setTxHash(""); 
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
    } catch (e) {
      // Ignored
    }
  };

  const runRecordRefund = async () => {
    if (!selectedItem) return;
    if (!txHash.trim()) {
      toast.error("Validation Error", "Please provide a transaction hash.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authFetch("/api/admin/refund", {
        method: "POST",
        body: JSON.stringify({ bounty_id: selectedItem.id, transaction_hash: txHash }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Action failed.");
      
      toast.success("Refund Recorded", "Refund transaction recorded successfully.");
      
      setData((prev) => {
        if (!prev) return prev;
        const updatedQueue = prev.queues.refund_candidates?.filter(b => b.id !== selectedItem.id);
        return { ...prev, queues: { ...prev.queues, refund_candidates: updatedQueue } };
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
          {["all", "rejected", "expired"].map((f) => (
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
            placeholder="Search poster or bounty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter refunds"
          />
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table} role="grid" aria-label="Refund Candidates">
          <thead>
            <tr>
              <th data-sortable="true" onClick={() => handleSort("poster")} aria-sort={sortCol === "poster" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Poster {renderSortIndicator("poster")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("title")} aria-sort={sortCol === "title" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Bounty {renderSortIndicator("title")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("amount")} aria-sort={sortCol === "amount" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>Amount {renderSortIndicator("amount")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("status")} aria-sort={sortCol === "status" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Status {renderSortIndicator("status")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("created")} aria-sort={sortCol === "created" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Created {renderSortIndicator("created")}</div>
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
                    <h3>Couldn't load refunds</h3>
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
                        <h3>No matching bounties</h3>
                        <p>No refund candidates match your current filters.</p>
                        <button type="button" className={styles.clearFilterBtn} onClick={() => { setFilter("all"); setSearch(""); }}>Clear filters</button>
                      </>
                    ) : (
                      <>
                        <h3>No refunds pending</h3>
                        <p>There are no bounties requiring refund transactions.</p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((bounty) => {
                const handle = getBountyPoster(bounty);
                
                return (
                  <tr key={bounty.id} onClick={() => handleRowClick(bounty.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(bounty.id); } }}>
                    <td>
                      <div className={styles.submitter}>
                        <div className={styles.avatar} aria-hidden="true">{getInitials(handle)}</div>
                        <span className={styles.handle} title={handle}>{handle}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.bountyTitle} title={bounty.title}>{bounty.title}</span>
                    </td>
                    <td>
                      <div className={styles.amount}>{formatAda(bounty.reward_amount)}</div>
                    </td>
                    <td>
                      <span className={styles.statusPill} data-status={bounty.status.toLowerCase()}>
                        {normalizeStatus(bounty.status)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.date} title={bounty.created_at ? new Date(bounty.created_at).toLocaleString() : undefined}>
                        {formatRelativeTime(bounty.created_at)}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button type="button" aria-label="View bounty" tabIndex={-1} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}>
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
                <span className={styles.modalAmount}>{formatAda(selectedItem.reward_amount)}</span>
              </div>
              <button type="button" className={styles.closeBtn} onClick={handleCloseModal} aria-label="Close modal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <h3 id="modal-title" className={styles.modalTitle}>{selectedItem.title}</h3>
              
              <div className={styles.submitterInfo}>
                <div className={styles.avatar} aria-hidden="true">{getInitials(getBountyPoster(selectedItem))}</div>
                <span className={styles.handle} style={{ fontSize: '14px' }}>{getBountyPoster(selectedItem)}</span>
                
                <div className={styles.hashGroup}>
                  <span>ID: {shortId(selectedItem.id)}</span>
                  <button type="button" className={styles.copyBtn} aria-label="Copy bounty ID" aria-live="polite" data-copied={copyStatus === "copied"} onClick={() => void handleCopyHash(selectedItem.id)}>
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
                  <div className={styles.contentLabel}>Bounty Description</div>
                  <div className={styles.contentValue}>
                    {selectedItem.description || "No description provided."}
                  </div>
                </div>
              </div>

              <div className={styles.adminNoteSection}>
                <label className={styles.contentLabel} htmlFor="tx-hash-modal">Refund Transaction Hash</label>
                <input
                  id="tx-hash-modal"
                  type="text"
                  className={styles.adminNoteTextarea}
                  style={{ minHeight: 'auto', padding: '10px 12px' }}
                  placeholder="64 character Cardano transaction hash"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.navControls}>
                <button type="button" className={styles.navBtn} disabled={!canGoPrev} aria-label="Previous bounty" onClick={() => setSelectedBountyId(items[selectedIndex - 1]?.id || null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button type="button" className={styles.navBtn} disabled={!canGoNext} aria-label="Next bounty" onClick={() => setSelectedBountyId(items[selectedIndex + 1]?.id || null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

              <button type="button" className={styles.approveBtn} disabled={isSubmitting} onClick={() => void runRecordRefund()}>
                {isSubmitting ? <div className={styles.spinner} /> : "Record Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
