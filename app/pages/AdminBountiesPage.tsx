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

type Submission = {
  id: string;
  status: string;
};

type Bounty = {
  id: string;
  title: string;
  description?: string | null;
  type?: string | null;
  custom_type?: string | null;
  status: string;
  reward_amount?: number | string | null;
  created_by?: string | null;
  deadline?: string | null;
  created_at?: string | null;
  poster?: UserProfile | null;
  submissions?: Submission[];
};

type DashboardResponse = {
  queues: {
    bounties?: Bounty[];
  };
  error?: string;
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

function getBountyPoster(bounty: Bounty) {
  return bounty.poster?.display_name || shortId(bounty.poster?.stake_address || bounty.created_by);
}

export function AdminBountiesPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [filter, setFilter] = useState("all"); 
  const [search, setSearch] = useState("");
  
  const [sortCol, setSortCol] = useState<"title" | "category" | "reward" | "submissions" | "status" | "poster" | "deadline">("deadline");
  const [sortDesc, setSortDesc] = useState(true);
  
  const [selectedBountyId, setSelectedBountyId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/dashboard/admin", { headers: { Accept: "application/json" } });
      const payload = (await response.json()) as DashboardResponse;

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
    void loadDashboard();
  }, [loadDashboard]);

  const items = useMemo(() => {
    let list = data?.queues.bounties || [];
    
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
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "category":
          const aCat = a.custom_type || a.type || "General";
          const bCat = b.custom_type || b.type || "General";
          cmp = aCat.localeCompare(bCat);
          break;
        case "reward":
          const aAmount = Number(a.reward_amount || 0);
          const bAmount = Number(b.reward_amount || 0);
          cmp = aAmount - bAmount;
          break;
        case "submissions":
          cmp = (a.submissions?.length || 0) - (b.submissions?.length || 0);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "poster":
          cmp = getBountyPoster(a).localeCompare(getBountyPoster(b));
          break;
        case "deadline":
          const aDate = a.deadline ? new Date(a.deadline).getTime() : 0;
          const bDate = b.deadline ? new Date(b.deadline).getTime() : 0;
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

  const renderSortIndicator = (col: typeof sortCol) => {
    if (sortCol !== col) return null;
    return sortDesc ? " ↓" : " ↑";
  };

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.tabs} role="tablist">
          {["all", "open", "completed", "cancelled", "expired"].map((f) => (
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
            aria-label="Filter bounties"
          />
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table} role="grid" aria-label="Bounties">
          <thead>
            <tr>
              <th data-sortable="true" onClick={() => handleSort("title")} aria-sort={sortCol === "title" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Title {renderSortIndicator("title")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("category")} aria-sort={sortCol === "category" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Category {renderSortIndicator("category")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("reward")} aria-sort={sortCol === "reward" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>Reward {renderSortIndicator("reward")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("submissions")} aria-sort={sortCol === "submissions" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>Submissions {renderSortIndicator("submissions")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("status")} aria-sort={sortCol === "status" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Status {renderSortIndicator("status")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("poster")} aria-sort={sortCol === "poster" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Poster {renderSortIndicator("poster")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("deadline")} aria-sort={sortCol === "deadline" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Deadline {renderSortIndicator("deadline")}</div>
              </th>
              <th><div className={`${styles.thContent} ${styles.right}`}>Actions</div></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} aria-hidden="true">
                  <td><div className={styles.shimmer} style={{ width: '180px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '80px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '60px', marginLeft: 'auto' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '40px', marginLeft: 'auto' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '60px', borderRadius: '999px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '100px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '70px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '24px', marginLeft: 'auto' }} /></td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={8}>
                  <div className={styles.emptyState}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <h3>Couldn't load bounties</h3>
                    <p>{error}</p>
                    <button type="button" className={styles.clearFilterBtn} onClick={() => void loadDashboard()}>Retry</button>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8}>
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
                        <h3>No bounties found</h3>
                        <p>There are no bounties available.</p>
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
                      <span className={styles.bountyTitle} title={bounty.title}>{bounty.title}</span>
                    </td>
                    <td>
                      {bounty.custom_type || bounty.type || "General"}
                    </td>
                    <td>
                      <div className={styles.amount}>{formatAda(bounty.reward_amount)}</div>
                    </td>
                    <td>
                      <div className={styles.amount}>{bounty.submissions?.length || 0}</div>
                    </td>
                    <td>
                      <span className={styles.statusPill} data-status={bounty.status.toLowerCase() === "open" ? "approved" : bounty.status.toLowerCase()}>
                        {normalizeStatus(bounty.status)}
                      </span>
                    </td>
                    <td>
                      <div className={styles.submitter}>
                        <div className={styles.avatar} aria-hidden="true">{getInitials(handle)}</div>
                        <span className={styles.handle} title={handle}>{handle}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.date}>{formatDate(bounty.deadline)}</span>
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
                <span className={styles.statusPill} data-status={selectedItem.status.toLowerCase() === "open" ? "approved" : selectedItem.status.toLowerCase()}>
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
                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel}>Category</div>
                  <div className={styles.contentValue}>
                    {selectedItem.custom_type || selectedItem.type || "General"}
                  </div>
                </div>
                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel}>Deadline</div>
                  <div className={styles.contentValue}>
                    {formatDate(selectedItem.deadline)}
                  </div>
                </div>
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

              <button type="button" className={styles.rejectBtn} disabled>
                Message Poster
              </button>
              <button type="button" className={styles.approveBtn} disabled>
                Edit Bounty
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
