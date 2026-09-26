"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import styles from "./AdminQueue.module.css";
import type { Bounty } from "@/types/bounty";
import { formatAda, formatDate, shortId } from "@/lib/formatters";
import { getBountyPoster } from "@/lib/bountyHelpers";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useItemNavigation } from "@/hooks/useItemNavigation";
import { CopyIconButton } from "@/components/shared/CopyIconButton";
import { StatusPill } from "@/components/shared/StatusPill";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { ModalCloseButton } from "@/components/shared/ModalCloseButton";
import { ModalNavControls } from "@/components/shared/ModalNavControls";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { TableActionChevron } from "@/components/shared/TableActionChevron";

type DashboardResponse = {
  queues: {
    bounties?: Bounty[];
  };
  error?: string;
};

export function AdminBountiesPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [filter, setFilter] = useState("all"); 
  const [search, setSearch] = useState("");
  
  const [sortCol, setSortCol] = useState<"title" | "category" | "reward" | "submissions" | "status" | "poster" | "deadline">("deadline");
  const [sortDesc, setSortDesc] = useState(true);
  
  const [selectedBountyId, setSelectedBountyId] = useState<string | null>(null);

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
  const { canGoPrev, canGoNext, goToPrev, goToNext } = useItemNavigation(
    items,
    selectedBountyId,
    setSelectedBountyId
  );

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

  const columns = useMemo<ColumnDef<Bounty>[]>(
    () => [
      {
        id: "title",
        header: "Title",
        sortable: true,
        cell: (bounty) => (
          <span className={styles.bountyTitle} title={bounty.title}>
            {bounty.title}
          </span>
        ),
      },
      {
        id: "category",
        header: "Category",
        sortable: true,
        cell: (bounty) => bounty.custom_type || bounty.type || "General",
      },
      {
        id: "reward",
        header: "Reward",
        align: "right",
        sortable: true,
        cell: (bounty) => <div className={styles.amount}>{formatAda(bounty.reward_amount)}</div>,
      },
      {
        id: "submissions",
        header: "Submissions",
        align: "right",
        sortable: true,
        cell: (bounty) => <div className={styles.amount}>{bounty.submissions?.length || 0}</div>,
      },
      {
        id: "status",
        header: "Status",
        sortable: true,
        cell: (bounty) => <StatusPill status={bounty.status} />,
      },
      {
        id: "poster",
        header: "Poster",
        sortable: true,
        cell: (bounty) => {
          const handle = getBountyPoster(bounty);
          return (
            <div className={styles.submitter}>
              <InitialsAvatar name={handle} />
              <span className={styles.handle} title={handle}>
                {handle}
              </span>
            </div>
          );
        },
      },
      {
        id: "deadline",
        header: "Deadline",
        sortable: true,
        cell: (bounty) => <span className={styles.date}>{formatDate(bounty.deadline)}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        sortable: false,
        cell: () => <TableActionChevron ariaLabel="View bounty" icon="eye" />,
      },
    ],
    []
  );

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

      <DataTable
        data={items}
        columns={columns}
        ariaLabel="Bounties"
        sortCol={sortCol}
        sortDesc={sortDesc}
        onSort={handleSort}
        onRowClick={(bounty) => handleRowClick(bounty.id)}
        isLoading={isLoading}
        error={error}
        onRetry={() => void loadDashboard()}
        emptyState={{
          title: search || filter !== "all" ? "No matching bounties" : "No bounties found",
          description: search || filter !== "all" ? "No bounties match your current filters." : "There are no bounties available.",
          action: (search || filter !== "all") ? (
            <button type="button" className={styles.clearFilterBtn} onClick={() => { setFilter("all"); setSearch(""); }}>
              Clear filters
            </button>
          ) : undefined,
        }}
      />

      {selectedItem && (
        <div className={styles.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderLeft}>
                <StatusPill status={selectedItem.status} />
                <span className={styles.modalAmount}>{formatAda(selectedItem.reward_amount)}</span>
              </div>
              <ModalCloseButton onClose={handleCloseModal} size={20} />
            </div>
            
            <div className={styles.modalBody}>
              <h3 id="modal-title" className={styles.modalTitle}>{selectedItem.title}</h3>
              
              <div className={styles.submitterInfo}>
                <InitialsAvatar name={getBountyPoster(selectedItem)} />
                <span className={styles.handle} style={{ fontSize: '14px' }}>{getBountyPoster(selectedItem)}</span>
                
                <div className={styles.hashGroup}>
                  <span>ID: {shortId(selectedItem.id)}</span>
                  <CopyIconButton
                    text={selectedItem.id}
                    label="Copy bounty ID"
                    className={styles.copyBtn}
                  />
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
              <ModalNavControls
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
                onPrev={goToPrev}
                onNext={goToNext}
                itemLabel="bounty"
              />

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
