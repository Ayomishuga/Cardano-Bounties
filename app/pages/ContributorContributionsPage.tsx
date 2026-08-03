"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import { ContentWithLinks } from "@/components/shared/ContentWithLinks";
import styles from "./AdminQueue.module.css";
import { AdminTableBodyShimmer } from "@/components/dashboard/ShimmerLoaders";

type Bounty = {
  id: string;
  title: string;
  description?: string | null;
  bounty_instructions?: string | null;
  reward_amount?: number | string | null;
  type?: string | null;
  custom_type?: string | null;
  status?: string | null;
  deadline?: string | null;
  project_name?: string | null;
  project_logo_url?: string | null;
  payout_type?: string | null;
  max_winners?: number | null;
};

type Allocation = {
  id: string;
  amount_lovelace: number | string;
  rank?: number | null;
  status: string;
  transaction_hash?: string | null;
  paid_at?: string | null;
};

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
  allocations?: Allocation[];
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

function formatAda(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(amount)} ADA`;
}

function formatLovelaceAsAda(value: number | string | null | undefined) {
  return formatAda(Number(value || 0) / 1_000_000);
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

function getBountyTypeLabel(bounty: Bounty | null) {
  return normalizeStatus(bounty?.custom_type || bounty?.type || "General");
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
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

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

  const selectedItem = useMemo(
    () => items.find((contribution) => contribution.id === selectedContributionId) || null,
    [items, selectedContributionId],
  );
  const selectedIndex = items.findIndex((contribution) => contribution.id === selectedContributionId);
  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex !== -1 && selectedIndex < items.length - 1;

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

  function renderSortIndicator(col: typeof sortCol) {
    if (sortCol !== col) return null;
    return sortDesc ? " ↓" : " ↑";
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1500);
    } catch (err) {
      console.error(err);
    }
  }

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

      <div className={styles.tableWrap}>
        <table className={styles.table} role="grid" aria-label="My contributions">
          <thead>
            <tr>
              <th data-sortable="true" onClick={() => handleSort("bounty")} aria-sort={sortCol === "bounty" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Bounty {renderSortIndicator("bounty")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("submitted")} aria-sort={sortCol === "submitted" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Submitted {renderSortIndicator("submitted")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("status")} aria-sort={sortCol === "status" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={styles.thContent}>Status {renderSortIndicator("status")}</div>
              </th>
              <th data-sortable="true" onClick={() => handleSort("payout")} aria-sort={sortCol === "payout" ? (sortDesc ? "descending" : "ascending") : "none"}>
                <div className={`${styles.thContent} ${styles.right}`}>Payout {renderSortIndicator("payout")}</div>
              </th>
              <th><div className={`${styles.thContent} ${styles.right}`}>Actions</div></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <AdminTableBodyShimmer columns={6} rows={5} />
            ) : error ? (
              <tr>
                <td colSpan={5}>
                  <div className={styles.emptyState}>
                    <h3>Could not load contributions</h3>
                    <p>{error}</p>
                    <button type="button" className={styles.clearFilterBtn} onClick={() => void loadContributions()}>Retry</button>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className={styles.emptyState}>
                    <h3>{search || filter !== "all" ? "No matching contributions" : "No contributions yet"}</h3>
                    <p>{search || filter !== "all" ? "No submissions match your current filters." : "Bounties you submit work to will appear here."}</p>
                    {search || filter !== "all" ? (
                      <button type="button" className={styles.clearFilterBtn} onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button>
                    ) : (
                      <Link href="/explore" className={styles.clearFilterBtn}>Explore bounties</Link>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((contribution) => {
                const bounty = getContributionBounty(contribution);
                const allocation = contribution.allocations?.[0];

                return (
                  <tr
                    key={contribution.id}
                    onClick={() => setSelectedContributionId(contribution.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedContributionId(contribution.id);
                      }
                    }}
                  >
                    <td>
                      <span className={styles.bountyTitle} title={bounty?.title}>{bounty?.title || "Unknown bounty"}</span>
                      <div className={styles.date}>{getBountyTypeLabel(bounty)}</div>
                    </td>
                    <td>
                      <span className={styles.date} title={contribution.submitted_at ? new Date(contribution.submitted_at).toLocaleString() : undefined}>
                        {formatRelativeTime(contribution.submitted_at)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.statusPill} data-status={getContributionState(contribution).toLowerCase().replace(/\s+/g, "_")}>
                        {getContributionState(contribution)}
                      </span>
                    </td>
                    <td>
                      <div className={styles.amount}>{allocation ? formatLovelaceAsAda(allocation.amount_lovelace) : "Not allocated"}</div>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button type="button" aria-label="View contribution" tabIndex={-1} style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}>
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

      {selectedItem ? (
        <ContributionModal
          canGoNext={canGoNext}
          canGoPrev={canGoPrev}
          contribution={selectedItem}
          copyStatus={copyStatus}
          onClose={() => setSelectedContributionId(null)}
          onCopy={handleCopy}
          onNext={() => setSelectedContributionId(items[selectedIndex + 1]?.id || null)}
          onPrev={() => setSelectedContributionId(items[selectedIndex - 1]?.id || null)}
        />
      ) : null}
    </div>
  );
}

function ContributionModal({
  canGoNext,
  canGoPrev,
  contribution,
  copyStatus,
  onClose,
  onCopy,
  onNext,
  onPrev,
}: {
  canGoNext: boolean;
  canGoPrev: boolean;
  contribution: Contribution;
  copyStatus: "idle" | "copied";
  onClose: () => void;
  onCopy: (value: string) => void;
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
            <span className={styles.statusPill} data-status={getContributionState(contribution).toLowerCase().replace(/\s+/g, "_")}>
              {getContributionState(contribution)}
            </span>
            <span className={styles.modalAmount}>{formatAda(bounty?.reward_amount)}</span>
            <span className={styles.modalMetaPill}>{normalizeStatus(bounty?.payout_type || "single")}</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.modalBody}>
          <h3 id="contribution-modal-title" className={styles.modalTitle}>{bounty?.title || "Contribution"}</h3>

          <div className={styles.submitterInfo}>
            <div className={styles.avatar} aria-hidden="true">{getInitials(getContributionState(contribution))}</div>
            <span className={styles.handle} style={{ fontSize: "14px" }}>{formatDateTime(contribution.submitted_at)}</span>
            <div className={styles.hashGroup}>
              <span>ID: {shortId(contribution.id)}</span>
              <button type="button" className={styles.copyBtn} aria-label="Copy contribution ID" aria-live="polite" data-copied={copyStatus === "copied"} onClick={() => void onCopy(contribution.id)}>
                {copyStatus === "copied" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                )}
              </button>
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
                  <strong>{getBountyTypeLabel(bounty)}</strong>
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
          <div className={styles.navControls}>
            <button type="button" className={styles.navBtn} disabled={!canGoPrev} aria-label="Previous contribution" onClick={onPrev}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button type="button" className={styles.navBtn} disabled={!canGoNext} aria-label="Next contribution" onClick={onNext}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
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

function getInitials(value: string | null | undefined) {
  if (!value) return "?";
  return value.slice(0, 2).toUpperCase();
}
