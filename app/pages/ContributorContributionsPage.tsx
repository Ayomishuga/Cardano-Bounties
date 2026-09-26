"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import { ContentWithLinks } from "@/components/shared/ContentWithLinks";
import styles from "./AdminQueue.module.css";
import type { Bounty, PayoutAllocation } from "@/types/bounty";
import {
  formatAda,
  formatLovelaceAsAda,
  normalizeStatus,
  shortId,
  formatDateTime,
  formatRelativeTime,
} from "@/lib/formatters";
import { getBountyCategoryLabel } from "@/lib/bountyHelpers";
import { CopyIconButton } from "@/components/shared/CopyIconButton";
import { StatusPill } from "@/components/shared/StatusPill";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { ModalCloseButton } from "@/components/shared/ModalCloseButton";
import { ModalNavControls } from "@/components/shared/ModalNavControls";
import { useItemNavigation } from "@/hooks/useItemNavigation";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { TableActionChevron } from "@/components/shared/TableActionChevron";

type Contribution = {
  id: string;
  bounty_id?: string | null;
  content?: string | null;
  status: string;
  feedback?: string | null;
  poster_review_status?: string | null;
  poster_feedback?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  transaction_hash?: string | null;
  bounties?: Bounty | Bounty[] | null;
  allocations?: PayoutAllocation[];
};

type ContributorResponse = {
  metrics?: Record<string, number>;
  queues?: {
    contributions?: Contribution[];
  };
  submissions?: Contribution[];
  error?: string;
};

function getContributionBounty(contribution: Contribution) {
  if (Array.isArray(contribution.bounties)) return contribution.bounties[0] || null;
  return contribution.bounties || null;
}

function getContributionState(contribution: Contribution) {
  const allocation = contribution.allocations?.[0];
  if (allocation?.status === "paid" || contribution.status === "paid") return "Paid";
  if (allocation?.status === "pending") return "Payout pending";
  if (contribution.status === "not_selected") return "Not selected";
  if (contribution.status === "approved") return "Approved";
  if (contribution.status === "rejected") return "Rejected";
  if (contribution.poster_review_status === "recommended_approval") return "Recommended";
  if (contribution.poster_review_status === "changes_requested") return "Changes requested";
  return "Submitted";
}

function getPayoutLabel(contribution: Contribution) {
  const allocation = contribution.allocations?.[0];
  if (!allocation) return "Not allocated";
  return `${formatLovelaceAsAda(allocation.amount_lovelace)} - ${normalizeStatus(allocation.status)}`;
}

export function ContributorContributionsPage() {
  const [data, setData] = useState<ContributorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"bounty" | "submitted" | "status" | "payout">("submitted");
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedContributionId, setSelectedContributionId] = useState<string | null>(null);

  const loadContributions = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/dashboard/contributor", { headers: { Accept: "application/json" } });
      const payload = (await response.json()) as ContributorResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load contributions.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load contributions.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadContributions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadContributions]);

  const contributions = useMemo(
    () => data?.queues?.contributions || data?.submissions || [],
    [data],
  );

  const items = useMemo(() => {
    let list = [...contributions];

    if (filter !== "all") {
      list = list.filter((contribution) => getContributionState(contribution).toLowerCase().replace(/\s+/g, "_") === filter);
    }

    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter((contribution) => {
        const bounty = getContributionBounty(contribution);
        return (
          (bounty?.title || "").toLowerCase().includes(query) ||
          (bounty?.project_name || "").toLowerCase().includes(query) ||
          (contribution.content || "").toLowerCase().includes(query)
        );
      });
    }

    list.sort((a, b) => {
      let comparison = 0;
      switch (sortCol) {
        case "bounty":
          comparison = (getContributionBounty(a)?.title || "").localeCompare(getContributionBounty(b)?.title || "");
          break;
        case "status":
          comparison = getContributionState(a).localeCompare(getContributionState(b));
          break;
        case "payout":
          comparison = Number(a.allocations?.[0]?.amount_lovelace || 0) - Number(b.allocations?.[0]?.amount_lovelace || 0);
          break;
        case "submitted":
          comparison = (a.submitted_at ? new Date(a.submitted_at).getTime() : 0) - (b.submitted_at ? new Date(b.submitted_at).getTime() : 0);
          break;
      }
      return sortDesc ? -comparison : comparison;
    });

    return list;
  }, [contributions, filter, search, sortCol, sortDesc]);

  const { selectedItem, canGoPrev, canGoNext, goToPrev, goToNext } = useItemNavigation(
    items,
    selectedContributionId,
    setSelectedContributionId
  );

  const summaryItems = [
    ["Total", data?.metrics?.total_submissions || 0],
    ["Recommended", data?.metrics?.recommended_submissions || 0],
    ["Pending payout", formatAda(data?.metrics?.pending_ada || 0)],
    ["Earned", formatAda(data?.metrics?.total_earned_ada || 0)],
  ];

  function handleSort(col: typeof sortCol) {
    if (sortCol === col) {
      setSortDesc((current) => !current);
    } else {
      setSortCol(col);
      setSortDesc(true);
    }
  }

  const columns = useMemo<ColumnDef<Contribution>[]>(
    () => [
      {
        id: "bounty",
        header: "Bounty",
        sortable: true,
        cell: (contribution) => {
          const bounty = getContributionBounty(contribution);
          return (
            <>
              <span className={styles.bountyTitle} title={bounty?.title}>{bounty?.title || "Unknown bounty"}</span>
              <div className={styles.date}>{getBountyCategoryLabel(bounty)}</div>
            </>
          );
        },
      },
      {
        id: "submitted",
        header: "Submitted",
        sortable: true,
        cell: (contribution) => (
          <span className={styles.date} title={contribution.submitted_at ? new Date(contribution.submitted_at).toLocaleString() : undefined}>
            {formatRelativeTime(contribution.submitted_at)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        sortable: true,
        cell: (contribution) => (
          <StatusPill
            status={getContributionState(contribution)}
            label={getContributionState(contribution)}
          />
        ),
      },
      {
        id: "payout",
        header: "Payout",
        align: "right",
        sortable: true,
        cell: (contribution) => {
          const allocation = contribution.allocations?.[0];
          return (
            <div className={styles.amount}>
              {allocation ? formatLovelaceAsAda(allocation.amount_lovelace) : "Not allocated"}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        sortable: false,
        cell: () => <TableActionChevron ariaLabel="View contribution" icon="eye" />,
      },
    ],
    []
  );

  return (
    <div className={styles.container}>
      <section className={styles.tableWrap}>
        <div className={styles.queueSummaryGrid}>
          {summaryItems.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.controls}>
        <div className={styles.tabs} role="tablist" aria-label="Contribution filters">
          {[
            ["all", "All"],
            ["submitted", "Submitted"],
            ["recommended", "Recommended"],
            ["payout_pending", "Payout pending"],
            ["paid", "Paid"],
            ["rejected", "Rejected"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              className={styles.tab}
              data-active={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
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
            placeholder="Search bounty, project, or notes..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search contributions"
          />
        </div>
      </div>

      <DataTable
        data={items}
        columns={columns}
        ariaLabel="My contributions"
        sortCol={sortCol}
        sortDesc={sortDesc}
        onSort={handleSort}
        onRowClick={(contribution) => setSelectedContributionId(contribution.id)}
        isLoading={isLoading}
        error={error}
        onRetry={() => void loadContributions()}
        emptyState={{
          title: search || filter !== "all" ? "No matching contributions" : "No contributions yet",
          description: search || filter !== "all" ? "No submissions match your current filters." : "Bounties you submit work to will appear here.",
          action: search || filter !== "all" ? (
            <button type="button" className={styles.clearFilterBtn} onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button>
          ) : (
            <Link href="/explore" className={styles.clearFilterBtn}>Explore bounties</Link>
          ),
        }}
      />

      {selectedItem ? (
        <ContributionModal
          canGoNext={canGoNext}
          canGoPrev={canGoPrev}
          contribution={selectedItem}
          onClose={() => setSelectedContributionId(null)}
          onNext={goToNext}
          onPrev={goToPrev}
        />
      ) : null}
    </div>
  );
}

function ContributionModal({
  canGoNext,
  canGoPrev,
  contribution,
  onClose,
  onNext,
  onPrev,
}: {
  canGoNext: boolean;
  canGoPrev: boolean;
  contribution: Contribution;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const bounty = getContributionBounty(contribution);
  const allocation = contribution.allocations?.[0] || null;

  return (
    <div className={styles.modalBackdrop} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="contribution-modal-title">
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <StatusPill
              status={getContributionState(contribution)}
              label={getContributionState(contribution)}
            />
            <span className={styles.modalAmount}>{formatAda(bounty?.reward_amount)}</span>
            <span className={styles.modalMetaPill}>{normalizeStatus(bounty?.payout_type || "single")}</span>
          </div>
          <ModalCloseButton onClose={onClose} size={20} />
        </div>

        <div className={styles.modalBody}>
          <h3 id="contribution-modal-title" className={styles.modalTitle}>{bounty?.title || "Contribution"}</h3>

          <div className={styles.submitterInfo}>
            <InitialsAvatar name={getContributionState(contribution)} />
            <span className={styles.handle} style={{ fontSize: "14px" }}>{formatDateTime(contribution.submitted_at)}</span>
            <div className={styles.hashGroup}>
              <span>ID: {shortId(contribution.id)}</span>
              <CopyIconButton
                text={contribution.id}
                label="Copy contribution ID"
                className={styles.copyBtn}
              />
            </div>
          </div>

          <div className={styles.contentSection}>
            <div className={styles.contentBlock} style={{ display: "flex", gap: 0 }}>
              <div style={{ flex: 1 }}>
                <div className={styles.contentLabel}>Submitted</div>
                <div className={styles.contentValue}>{formatDateTime(contribution.submitted_at)}</div>
              </div>
              <div style={{ flex: 1, borderLeft: "1px solid var(--line)", paddingLeft: 16 }}>
                <div className={styles.contentLabel}>Payout</div>
                <div className={styles.contentValue}>{getPayoutLabel(contribution)}</div>
              </div>
            </div>

            <div className={styles.contentBlock}>
              <div className={styles.contentLabel}>Contributor note</div>
              <div className={`${styles.contentValue} ${!contribution.content ? styles.missingValue : ""}`}>
                <ContentWithLinks content={contribution.content} linkClassName={styles.contentLink} />
              </div>
            </div>

            <div className={styles.contentBlock}>
              <div className={styles.posterReviewHeader}>
                <div>
                  <div className={styles.contentLabel}>Poster review</div>
                  <div className={styles.contentValue}>{normalizeStatus(contribution.poster_review_status || "Pending")}</div>
                </div>
                <span>{normalizeStatus(contribution.status)}</span>
              </div>
              <div className={`${styles.contentValue} ${!contribution.poster_feedback ? styles.missingValue : ""}`}>
                {contribution.poster_feedback || "No poster feedback yet."}
              </div>
            </div>

            <div className={styles.contentBlock}>
              <div className={styles.contentLabel}>Admin feedback</div>
              <div className={`${styles.contentValue} ${!contribution.feedback ? styles.missingValue : ""}`}>
                {contribution.feedback || "No admin feedback yet."}
              </div>
            </div>

            {allocation ? (
              <div className={styles.contentBlock}>
                <div className={styles.contentLabel}>Payout allocation</div>
                <div className={styles.contentValue}>
                  {allocation.rank ? `Rank ${allocation.rank} - ` : ""}
                  {formatLovelaceAsAda(allocation.amount_lovelace)} - {normalizeStatus(allocation.status)}
                  {allocation.transaction_hash ? (
                    <>
                      <br />
                      Tx: {shortId(allocation.transaction_hash)}
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <section className={styles.contextPanel} aria-label="Bounty context">
            <div className={styles.contextHeader}>
              <span>Bounty context</span>
            </div>
            <div className={styles.contextBody}>
              <div className={styles.contextMetaGrid}>
                <div>
                  <span>Category</span>
                  <strong>{getBountyCategoryLabel(bounty)}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{normalizeStatus(bounty?.status || "Unknown")}</strong>
                </div>
                <div>
                  <span>Deadline</span>
                  <strong>{bounty?.deadline ? formatDateTime(bounty.deadline) : "Not set"}</strong>
                </div>
                <div>
                  <span>Winner limit</span>
                  <strong>{bounty?.max_winners ?? 1}</strong>
                </div>
              </div>
              <div className={styles.contextBlock}>
                <div className={styles.contentLabel}>Instructions</div>
                <div className={`${styles.contentValue} ${!bounty?.bounty_instructions ? styles.missingValue : ""}`}>
                  {bounty?.bounty_instructions || "No bounty instructions provided."}
                </div>
              </div>
              {bounty?.id ? (
                <Link href={`/bounties/${bounty.id}`} className={styles.contextLink}>
                  Open bounty details
                </Link>
              ) : null}
            </div>
          </section>
        </div>

        <div className={styles.modalFooter}>
          <ModalNavControls
            itemLabel="contribution"
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onPrev={onPrev}
            onNext={onNext}
          />
          {bounty?.id ? (
            <Link href={`/bounties/${bounty.id}`} className={styles.clearFilterBtn}>
              View bounty
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
