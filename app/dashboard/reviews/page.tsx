"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppWallet } from "@/components/wallet/WalletProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import { ContentWithLinks } from "@/components/shared/ContentWithLinks";
import styles from "@/app/pages/AdminQueue.module.css";
import { type Bounty, type Submission } from "@/types/bounty";
import { formatAda, formatLovelaceAsAda, normalizeStatus, formatDate, formatDateTime, shortId, formatRelativeTime } from "@/lib/formatters";
import { getSubmissionBounty, getPayoutTypeLabel, getPayoutSummary, getBountyCategoryLabel } from "@/lib/bountyHelpers";
import { CopyIconButton } from "@/components/shared/CopyIconButton";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { StatusPill } from "@/components/shared/StatusPill";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { ModalCloseButton } from "@/components/shared/ModalCloseButton";
import { ModalNavControls } from "@/components/shared/ModalNavControls";
import { useItemNavigation } from "@/hooks/useItemNavigation";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { TableActionChevron } from "@/components/shared/TableActionChevron";

type PosterDashboardResponse = {
  queues?: {
    pending_submission_reviews?: Submission[];
  };
};

function getBountySubmissionCount(bounty: Bounty | null) {
  return bounty?.submissions?.length ?? 0;
}

function getBountyApprovedCount(bounty: Bounty | null) {
  return bounty?.submissions?.filter((submission) =>
    submission.status === "approved" || submission.poster_review_status === "recommended_approval"
  ).length ?? 0;
}

export default function ReviewsPage() {
  const { isAuthenticated, reauthenticate } = useAppWallet();
  const toast = useToast();
  const [data, setData] = useState<PosterDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"title" | "submitter" | "date" | "status">("date");
  const [sortDesc, setSortDesc] = useState(true);
  
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [actionId, setActionId] = useState("");
  const [contextOpen, setContextOpen] = useState(true);
  const [reviewNote, setReviewNote] = useState("");

  const loadReviews = useCallback(async () => {
    if (!isAuthenticated) { setIsLoading(false); return; }
    setIsLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/dashboard/poster", { headers: { Accept: "application/json" } });
      const payload = (await res.json()) as PosterDashboardResponse;
      if (!res.ok) throw new Error("Unable to load submission reviews.");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load submission reviews.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReviews();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadReviews]);

  const items = useMemo(() => {
    let list = data?.queues?.pending_submission_reviews || [];
    
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => {
        const title = getSubmissionBounty(s)?.title?.toLowerCase() || "";
        const sub = (s.contributor_id || "").toLowerCase();
        return title.includes(q) || sub.includes(q);
      });
    }
    
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "title":
          const titleA = getSubmissionBounty(a)?.title || "";
          const titleB = getSubmissionBounty(b)?.title || "";
          cmp = titleA.localeCompare(titleB);
          break;
        case "submitter":
          cmp = (a.contributor_id || "").localeCompare(b.contributor_id || "");
          break;
        case "date":
          const aDate = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
          const bDate = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
          cmp = aDate - bDate;
          break;
        case "status":
          const aStatus = a.poster_review_status || a.status;
          const bStatus = b.poster_review_status || b.status;
          cmp = aStatus.localeCompare(bStatus);
          break;
      }
      return sortDesc ? -cmp : cmp;
    });

    return list;
  }, [data, search, sortCol, sortDesc]);

  const { selectedItem, canGoPrev, canGoNext, goToPrev, goToNext } = useItemNavigation(
    items,
    selectedSubmissionId,
    (id) => {
      setSelectedSubmissionId(id);
      setContextOpen(true);
    }
  );
  const selectedBounty = selectedItem ? getSubmissionBounty(selectedItem) : null;

  useEffect(() => {
    if (selectedItem) {
      const timeoutId = window.setTimeout(() => {
        setReviewNote(selectedItem.poster_feedback || "");
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

  useEscapeKey(handleCloseModal, Boolean(selectedSubmissionId));

  const runReviewAction = async (status: "recommended_approval" | "changes_requested", label: string) => {
    if (!selectedItem) return;
    setActionId(selectedItem.id);
    try {
      if (!isAuthenticated) await reauthenticate();
      const res = await authFetch(`/api/submissions/${selectedItem.id}/poster-review`, {
        method: "PATCH",
        body: JSON.stringify({ status, feedback: reviewNote }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Action failed.");
      
      toast.success("Review updated", label);
      
      setData((prev) => {
        if (!prev) return prev;
        const updatedQueue = prev.queues?.pending_submission_reviews?.filter(s => s.id !== selectedItem.id);
        return { ...prev, queues: { ...prev.queues, pending_submission_reviews: updatedQueue } };
      });
      
      handleCloseModal();
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : "Unable to complete review.");
    } finally {
      setActionId("");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <div className={styles.tableWrap} style={{ marginTop: '20px' }}>
          <table className={styles.table}>
            <tbody>
              <tr>
                <td>
                  <div className={styles.emptyState}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <h3>Authentication required</h3>
                    <p>Reviewing submissions requires an authenticated wallet session.</p>
                    <button type="button" className={styles.clearFilterBtn} onClick={() => void reauthenticate()}>Sign verification</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const columns = useMemo<ColumnDef<Submission>[]>(
    () => [
      {
        id: "title",
        header: "Bounty",
        sortable: true,
        cell: (submission) => {
          const bounty = getSubmissionBounty(submission);
          return (
            <span className={styles.bountyTitle} title={bounty?.title}>
              {bounty?.title || "Unknown Bounty"}
            </span>
          );
        },
      },
      {
        id: "submitter",
        header: "Submitter",
        sortable: true,
        cell: (submission) => {
          const handle = shortId(submission.contributor_id);
          return (
            <div className={styles.submitter}>
              <InitialsAvatar name={handle} />
              <span className={styles.handle} title={submission.contributor_id || ""}>
                {handle}
              </span>
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        sortable: true,
        cell: (submission) => (
          <StatusPill status={submission.poster_review_status || submission.status} />
        ),
      },
      {
        id: "date",
        header: "Date",
        sortable: true,
        cell: (submission) => (
          <span className={styles.date} title={submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : undefined}>
            {formatRelativeTime(submission.submitted_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        sortable: false,
        cell: () => <TableActionChevron ariaLabel="Review submission" icon="eye" />,
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
            placeholder="Search bounty title or submitter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter submissions"
          />
        </div>
      </div>

      <DataTable
        data={items}
        columns={columns}
        ariaLabel="Submission Reviews"
        sortCol={sortCol}
        sortDesc={sortDesc}
        onSort={handleSort}
        onRowClick={(submission) => handleRowClick(submission.id)}
        isLoading={isLoading}
        error={error}
        onRetry={() => void loadReviews()}
        emptyState={{
          title: search ? "No matching submissions" : "All caught up",
          description: search ? "No submissions match your search." : "You have no submissions awaiting your review.",
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
                <StatusPill status={selectedItem.poster_review_status || selectedItem.status} />
                <span className={styles.modalAmount}>{formatAda(selectedBounty?.reward_amount)}</span>
                <span className={styles.modalMetaPill}>{getPayoutTypeLabel(selectedBounty?.payout_type)}</span>
                <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {getBountySubmissionCount(selectedBounty)} submission{getBountySubmissionCount(selectedBounty) === 1 ? "" : "s"}
                  {" · "}
                  <span style={{ color: "var(--status-success-text)" }}>{getBountyApprovedCount(selectedBounty)} recommended</span>
                </span>
              </div>
              <ModalCloseButton onClose={handleCloseModal} size={20} />
            </div>
            
            <div className={styles.modalBody}>
              <h3 id="modal-title" className={styles.modalTitle}>{selectedBounty?.title || "Submission"}</h3>
              
              <div className={styles.submitterInfo}>
                <InitialsAvatar name={shortId(selectedItem.contributor_id)} />
                <span className={styles.handle} style={{ fontSize: '14px' }}>{shortId(selectedItem.contributor_id)}</span>
                
                <div className={styles.hashGroup}>
                  <span>ID: {shortId(selectedItem.id)}</span>
                  <CopyIconButton
                    text={selectedItem.id}
                    label="Copy submission ID"
                    className={styles.copyBtn}
                  />
                </div>
              </div>

              <section className={styles.contextPanel} aria-label="Bounty context for poster submission review">
                <button
                  type="button"
                  className={styles.contextHeader}
                  onClick={() => setContextOpen((open) => !open)}
                  aria-expanded={contextOpen}
                >
                  <span>Bounty context and acceptance criteria</span>
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
                        {selectedBounty?.bounty_instructions || "No acceptance criteria were provided. Judge this submission carefully before recommending approval."}
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
                <div className={styles.contentBlock} style={{ display: "flex", gap: 0 }}>
                  <div style={{ flex: 1 }}>
                    <div className={styles.contentLabel}>Submitted</div>
                    <div className={styles.contentValue}>{formatDateTime(selectedItem.submitted_at)}</div>
                  </div>
                  <div style={{ flex: 1, borderLeft: "1px solid var(--line)", paddingLeft: 16 }}>
                    <div className={styles.contentLabel}>Competing submissions</div>
                    <div className={styles.contentValue}>
                      {getBountySubmissionCount(selectedBounty)} total
                      <span style={{ marginLeft: 8, color: "var(--status-success-text)" }}>
                        · {getBountyApprovedCount(selectedBounty)} recommended
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel}>Contributor note</div>
                  <div className={styles.contentValue}>
                    <ContentWithLinks content={selectedItem.content} linkClassName={styles.contentLink} />
                  </div>
                </div>
              </div>

              <div className={styles.adminNoteSection}>
                <label className={styles.contentLabel} htmlFor="poster-review-note">
                  Poster review note
                  <span style={{ fontWeight: 400, fontSize: 11, textTransform: "none", marginLeft: 6, color: "var(--muted)" }}>
                    (saved with your recommendation)
                  </span>
                </label>
                <textarea
                  id="poster-review-note"
                  className={styles.adminNoteTextarea}
                  placeholder="Add why this submission should be approved or what needs to change."
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <ModalNavControls
                itemLabel="submission"
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
                onPrev={goToPrev}
                onNext={goToNext}
              />

              <button type="button" className={styles.rejectBtn} disabled={actionId === selectedItem.id} onClick={() => void runReviewAction("changes_requested", "Submission marked for changes.")}>
                {actionId === selectedItem.id ? <div className={styles.spinner} /> : "Request Changes"}
              </button>
              <button type="button" className={styles.approveBtn} disabled={actionId === selectedItem.id} onClick={() => void runReviewAction("recommended_approval", "Submission recommended for admin approval.")}>
                {actionId === selectedItem.id ? <div className={styles.spinner} /> : "Recommend Approval"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
