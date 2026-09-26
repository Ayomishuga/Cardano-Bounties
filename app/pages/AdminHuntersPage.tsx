"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import styles from "./AdminQueue.module.css";
import type { Bounty, Submission } from "@/types/bounty";
import { formatAda, formatDate, shortId } from "@/lib/formatters";
import { getSubmissionBounty } from "@/lib/bountyHelpers";
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

export function AdminHuntersPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"wallet" | "total" | "accepted" | "ada" | "active" | "last">("total");
  const [sortDesc, setSortDesc] = useState(true);
  
  const [selectedHunterKey, setSelectedHunterKey] = useState<string | null>(null);

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

  const { selectedItem, canGoPrev, canGoNext, goToPrev, goToNext } = useItemNavigation(
    items,
    selectedHunterKey,
    setSelectedHunterKey,
    (h) => h.key
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
    setSelectedHunterKey(key);
  };

  const handleCloseModal = () => {
    setSelectedHunterKey(null);
  };

  useEscapeKey(handleCloseModal, Boolean(selectedHunterKey));

  const columns = useMemo<ColumnDef<HunterStats>[]>(
    () => [
      {
        id: "wallet",
        header: "Wallet",
        sortable: true,
        cell: (hunter) => (
          <div className={styles.submitter}>
            <InitialsAvatar name={hunter.wallet} />
            <span className={styles.handle} title={hunter.wallet}>
              {shortId(hunter.wallet)}
            </span>
          </div>
        ),
      },
      {
        id: "total",
        header: "Total Submissions",
        align: "right",
        sortable: true,
        cell: (hunter) => <div className={styles.amount}>{hunter.totalSubmissions}</div>,
      },
      {
        id: "accepted",
        header: "Accepted",
        align: "right",
        sortable: true,
        cell: (hunter) => <div className={styles.amount}>{hunter.accepted}</div>,
      },
      {
        id: "ada",
        header: "ADA Earned",
        align: "right",
        sortable: true,
        cell: (hunter) => <div className={styles.amount}>{formatAda(hunter.adaEarned)}</div>,
      },
      {
        id: "active",
        header: "Active Submissions",
        align: "right",
        sortable: true,
        cell: (hunter) => <div className={styles.amount}>{hunter.activeSubmissions}</div>,
      },
      {
        id: "last",
        header: "Last Active",
        sortable: true,
        cell: (hunter) => <span className={styles.date}>{formatDate(hunter.lastActive)}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        sortable: false,
        cell: () => <TableActionChevron ariaLabel="View hunter" icon="eye" />,
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
            placeholder="Search hunter wallet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter hunters"
          />
        </div>
      </div>

      <DataTable
        data={items}
        columns={columns}
        ariaLabel="Hunters"
        sortCol={sortCol}
        sortDesc={sortDesc}
        onSort={handleSort}
        onRowClick={(hunter) => handleRowClick(hunter.key)}
        keyExtractor={(hunter) => hunter.key}
        isLoading={isLoading}
        error={error}
        onRetry={() => void loadDashboard()}
        emptyState={{
          title: search ? "No matching hunters" : "No hunters found",
          description: search ? "No hunters match your search." : "There are no hunters in the system yet.",
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
                <StatusPill status="approved" label={`${selectedItem.accepted} Accepted`} />
                <span className={styles.modalAmount}>{formatAda(selectedItem.adaEarned)}</span>
              </div>
              <ModalCloseButton onClose={handleCloseModal} size={20} />
            </div>
            
            <div className={styles.modalBody}>
              <h3 id="modal-title" className={styles.modalTitle}>Hunter Profile</h3>
              
              <div className={styles.submitterInfo}>
                <InitialsAvatar name={selectedItem.wallet} />
                <span className={styles.handle} style={{ fontSize: '14px' }}>{shortId(selectedItem.wallet)}</span>
                
                <div className={styles.hashGroup}>
                  <CopyIconButton
                    text={selectedItem.wallet}
                    label="Copy hunter address"
                    className={styles.copyBtn}
                  />
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
                        <StatusPill status={s.status} />
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
              <ModalNavControls
                itemLabel="hunter"
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
                onPrev={goToPrev}
                onNext={goToNext}
              />

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
