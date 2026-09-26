"use client";
// v2 – full bounty detail modal
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import styles from "./AdminQueue.module.css";
import type { Bounty } from "@/types/bounty";
import { formatAda, formatDate, normalizeStatus, shortId, formatRelativeTime } from "@/lib/formatters";
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
    bounty_reviews?: Bounty[];
  };
  error?: string;
};

export function AdminApprovalsPage() {
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
  const [adminNote, setAdminNote] = useState("");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/dashboard/admin", { headers: { Accept: "application/json" } });
      const payload = (await response.json()) as DashboardResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load approvals.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load approvals.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const items = useMemo(() => {
    let list = data?.queues.bounty_reviews || [];
    
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
    setAdminNote(""); // Clear note when opening a new one
  };

  const handleCloseModal = () => {
    setSelectedBountyId(null);
  };

  useEscapeKey(handleCloseModal, Boolean(selectedBountyId));

  const runAction = async (status: "open" | "rejected") => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      const response = await authFetch(`/api/bounties/${selectedItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }), // Note: existing logic might not persist the note, we send it anyway or just let it be UI-only if unsupported
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Action failed.");
      
      toast.success("Dashboard updated", `Bounty ${status === "open" ? "approved" : "rejected"}.`);
      
      setData((prev) => {
        if (!prev) return prev;
        const updatedQueue = prev.queues.bounty_reviews?.map(b => 
          b.id === selectedItem.id ? { ...b, status } : b
        );
        return { ...prev, queues: { ...prev.queues, bounty_reviews: updatedQueue } };
      });
      
      handleCloseModal();
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : "Unable to complete action.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = useMemo<ColumnDef<Bounty>[]>(
    () => [
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
        id: "title",
        header: "Bounty",
        sortable: true,
        cell: (bounty) => (
          <span className={styles.bountyTitle} title={bounty.title}>
            {bounty.title}
          </span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        align: "right",
        sortable: true,
        cell: (bounty) => <div className={styles.amount}>{formatAda(bounty.reward_amount)}</div>,
      },
      {
        id: "status",
        header: "Status",
        sortable: true,
        cell: (bounty) => <StatusPill status={bounty.status} />,
      },
      {
        id: "created",
        header: "Created",
        sortable: true,
        cell: (bounty) => (
          <span className={styles.date} title={bounty.created_at ? new Date(bounty.created_at).toLocaleString() : undefined}>
            {formatRelativeTime(bounty.created_at)}
          </span>
        ),
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
          {["all", "awaiting_admin_review", "open", "rejected"].map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={styles.tab}
              data-active={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === "awaiting_admin_review" ? "Pending Review" : f.charAt(0).toUpperCase() + f.slice(1)}
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
            aria-label="Filter approvals"
          />
        </div>
      </div>

      <DataTable
        data={items}
        columns={columns}
        ariaLabel="Bounty Approvals"
        sortCol={sortCol}
        sortDesc={sortDesc}
        onSort={handleSort}
        onRowClick={(bounty) => handleRowClick(bounty.id)}
        isLoading={isLoading}
        error={error}
        onRetry={() => void loadDashboard()}
        emptyState={{
          title: search || filter !== "all" ? "No matching bounties" : "No approvals yet",
          description: search || filter !== "all" ? "No bounties match your current filters." : "There are no bounties waiting for approval.",
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

              {/* ── Poster identity + ID ── */}
              <div className={styles.submitterInfo}>
                <InitialsAvatar name={getBountyPoster(selectedItem)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{getBountyPoster(selectedItem)}</div>
                  {selectedItem.poster?.stake_address && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', marginTop: 2 }}>
                      {shortId(selectedItem.poster.stake_address)}
                    </div>
                  )}
                </div>
                <div className={styles.hashGroup}>
                  <span>ID: {shortId(selectedItem.id)}</span>
                  <CopyIconButton
                    text={selectedItem.id}
                    label="Copy bounty ID"
                    className={styles.copyBtn}
                  />
                </div>
              </div>

              {/* ── Metadata + Financials ── */}
              <div className={styles.contentSection}>
                {/* Row 1: Category | Deadline */}
                <div className={styles.contentBlock} style={{ display: 'flex', gap: 0 }}>
                  <div style={{ flex: 1 }}>
                    <div className={styles.contentLabel}>Category</div>
                    <div className={styles.contentValue}>
                      {selectedItem.custom_type || selectedItem.type || "—"}
                    </div>
                  </div>
                  <div style={{ flex: 1, borderLeft: '1px solid var(--line)', paddingLeft: 16 }}>
                    <div className={styles.contentLabel}>Deadline</div>
                    <div className={styles.contentValue}>
                      {selectedItem.deadline
                        ? formatDate(selectedItem.deadline)
                        : "Rolling (no deadline)"}
                    </div>
                  </div>
                </div>

                {/* Row 2: Project | Submitted */}
                <div className={styles.contentBlock} style={{ display: 'flex', gap: 0 }}>
                  <div style={{ flex: 1 }}>
                    <div className={styles.contentLabel}>Project</div>
                    <div className={styles.contentValue}>{selectedItem.project_name || "Independent bounty"}</div>
                  </div>
                  <div style={{ flex: 1, borderLeft: '1px solid var(--line)', paddingLeft: 16 }}>
                    <div className={styles.contentLabel}>Submitted</div>
                    <div className={styles.contentValue} title={selectedItem.created_at ?? ""}>
                      {formatRelativeTime(selectedItem.created_at)}
                    </div>
                  </div>
                </div>

                {/* Row 3: Financials — Reward | Platform Fee | Total */}
                <div className={styles.contentBlock} style={{ display: 'flex', gap: 0 }}>
                  <div style={{ flex: 1 }}>
                    <div className={styles.contentLabel}>Contributor Reward</div>
                    <div className={styles.contentValue} style={{ fontWeight: 700, color: 'var(--ink)' }}>
                      {formatAda(selectedItem.reward_amount)}
                    </div>
                  </div>
                  <div style={{ flex: 1, borderLeft: '1px solid var(--line)', paddingLeft: 16 }}>
                    <div className={styles.contentLabel}>Platform Fee</div>
                    <div className={styles.contentValue}>{formatAda(selectedItem.platform_fee_amount)}</div>
                  </div>
                  <div style={{ flex: 1, borderLeft: '1px solid var(--line)', paddingLeft: 16 }}>
                    <div className={styles.contentLabel}>Total Funded</div>
                    <div className={styles.contentValue}>{formatAda(selectedItem.total_funding_amount)}</div>
                  </div>
                </div>

                {/* Row 4: Description */}
                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel}>Bounty Description</div>
                  <div className={styles.contentValue}>
                    {selectedItem.description || "No description provided."}
                  </div>
                </div>

                {/* Row 5: Instructions (conditional) */}
                {selectedItem.bounty_instructions && (
                  <div className={styles.contentBlock}>
                    <div className={styles.contentLabel}>Bounty Instructions</div>
                    <div className={styles.contentValue}>{selectedItem.bounty_instructions}</div>
                  </div>
                )}

                {/* Row 6: Escrow tx (conditional) */}
                {selectedItem.escrow_tx_hash && (
                  <div className={styles.contentBlock}>
                    <div className={styles.contentLabel}>Escrow Transaction</div>
                    <div className={styles.hashGroup} style={{ marginLeft: 0, justifyContent: 'flex-start' }}>
                      <span className={styles.contentValue} style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {shortId(selectedItem.escrow_tx_hash)}
                      </span>
                      <CopyIconButton
                        text={selectedItem.escrow_tx_hash!}
                        label="Copy escrow tx hash"
                        className={styles.copyBtn}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Admin note ── */}
              <div className={styles.adminNoteSection}>
                <label className={styles.contentLabel} htmlFor="admin-note-modal">Admin Note</label>
                <textarea
                  id="admin-note-modal"
                  className={styles.adminNoteTextarea}
                  placeholder="Add an internal note for this review."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
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

              {selectedItem.status.toLowerCase() !== "awaiting_admin_review" ? (
                <div className={styles.resolutionState}>
                  {normalizeStatus(selectedItem.status)} 
                </div>
              ) : (
                <>
                  <button type="button" className={styles.rejectBtn} disabled={isSubmitting} onClick={() => void runAction("rejected")}>
                    {isSubmitting ? <div className={styles.spinner} /> : "Reject"}
                  </button>
                  <button type="button" className={styles.approveBtn} disabled={isSubmitting} onClick={() => void runAction("open")}>
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
