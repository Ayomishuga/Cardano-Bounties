"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import styles from "./AdminQueue.module.css";
import type { Bounty } from "@/types/bounty";
import { formatAda, formatDate, shortId } from "@/lib/formatters";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { CopyIconButton } from "@/components/shared/CopyIconButton";
import { StatusPill } from "@/components/shared/StatusPill";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { ModalCloseButton } from "@/components/shared/ModalCloseButton";
import { ModalNavControls } from "@/components/shared/ModalNavControls";
import { useItemNavigation } from "@/hooks/useItemNavigation";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { TableActionChevron } from "@/components/shared/TableActionChevron";

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

export function AdminPostersPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"wallet" | "total" | "ada" | "approval" | "active" | "joined">("total");
  const [sortDesc, setSortDesc] = useState(true);
  
  const [selectedPosterKey, setSelectedPosterKey] = useState<string | null>(null);

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

  const { selectedItem, canGoPrev, canGoNext, goToPrev, goToNext } = useItemNavigation(
    items,
    selectedPosterKey,
    setSelectedPosterKey,
    (p) => p.key
  );

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

  useEscapeKey(handleCloseModal, Boolean(selectedPosterKey));

  const columns = useMemo<ColumnDef<PosterStats>[]>(
    () => [
      {
        id: "wallet",
        header: "Wallet",
        sortable: true,
        cell: (poster) => {
          const handle = poster.displayName || shortId(poster.wallet);
          return (
            <div className={styles.submitter}>
              <InitialsAvatar name={handle} />
              <span className={styles.handle} title={poster.wallet}>
                {handle}
              </span>
            </div>
          );
        },
      },
      {
        id: "total",
        header: "Total Bounties",
        align: "right",
        sortable: true,
        cell: (poster) => <div className={styles.amount}>{poster.totalBounties}</div>,
      },
      {
        id: "ada",
        header: "Total ADA",
        align: "right",
        sortable: true,
        cell: (poster) => <div className={styles.amount}>{formatAda(poster.totalAda)}</div>,
      },
      {
        id: "approval",
        header: "Approval Rate",
        align: "right",
        sortable: true,
        cell: (poster) => <div className={styles.amount}>{poster.approvalRate}%</div>,
      },
      {
        id: "active",
        header: "Active Bounties",
        align: "right",
        sortable: true,
        cell: (poster) => <div className={styles.amount}>{poster.activeBounties}</div>,
      },
      {
        id: "joined",
        header: "Joined",
        sortable: true,
        cell: (poster) => <span className={styles.date}>{formatDate(poster.joined)}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        sortable: false,
        cell: () => <TableActionChevron ariaLabel="View poster" icon="eye" />,
      },
    ],
    []
  );

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

      <DataTable
        data={items}
        columns={columns}
        ariaLabel="Posters"
        sortCol={sortCol}
        sortDesc={sortDesc}
        onSort={handleSort}
        onRowClick={(poster) => handleRowClick(poster.key)}
        keyExtractor={(poster) => poster.key}
        isLoading={isLoading}
        error={error}
        onRetry={() => void loadDashboard()}
        emptyState={{
          title: search ? "No matching posters" : "No posters found",
          description: search ? "No posters match your search." : "There are no posters in the system yet.",
          action: search ? (
            <button type="button" className={styles.clearFilterBtn} onClick={() => setSearch("")}>
              Clear search
            </button>
          ) : undefined,
        }}
      />

      {selectedItem && (
        <div className={styles.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderLeft}>
                <StatusPill status="approved" label={`${selectedItem.approvalRate}% Approval`} />
                <span className={styles.modalAmount}>{formatAda(selectedItem.totalAda)}</span>
              </div>
              <ModalCloseButton onClose={handleCloseModal} size={20} />
            </div>
            
            <div className={styles.modalBody}>
              <h3 id="modal-title" className={styles.modalTitle}>{selectedItem.displayName || "Poster Profile"}</h3>
              
              <div className={styles.submitterInfo}>
                <InitialsAvatar name={selectedItem.displayName || shortId(selectedItem.wallet)} />
                <span className={styles.handle} style={{ fontSize: '14px' }}>{shortId(selectedItem.wallet)}</span>
                
                <div className={styles.hashGroup}>
                  <CopyIconButton
                    text={selectedItem.wallet}
                    label="Copy poster address"
                    className={styles.copyBtn}
                  />
                </div>
              </div>

              <div className={styles.contentSection}>
                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel}>Recent Bounties</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedItem.bounties.slice(0, 5).map((b) => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }}>{b.title}</span>
                        <StatusPill status={b.status} />
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
              <ModalNavControls
                itemLabel="poster"
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
                onPrev={goToPrev}
                onNext={goToNext}
              />

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
