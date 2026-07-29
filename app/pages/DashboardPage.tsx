"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WalletConnect } from "@/components/wallet/WalletConnect";
import { useAppWallet } from "@/components/wallet/WalletProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import styles from "./DashboardPage.module.css";
import { MetricGridShimmer, WorkspaceQueueShimmer, HealthPanelShimmer, AdminTableShimmer } from "@/components/dashboard/ShimmerLoaders";

type Bounty = {
  id: string;
  title: string;
  description?: string | null;
  type?: string | null;
  custom_type?: string | null;
  status: string;
  reward_amount?: number | string | null;
  total_funding_amount?: number | string | null;
  escrow_address?: string | null;
  escrow_tx_hash?: string | null;
  escrow_submitted_at?: string | null;
  escrow_confirmed_at?: string | null;
  escrow_last_checked_at?: string | null;
  escrow_verification_attempts?: number | null;
  escrow_verification_error?: string | null;
  refund_tx_hash?: string | null;
  refunded_at?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  poster?: UserProfile | null;
  submissions?: Submission[];
};

type UserProfile = {
  id: string;
  stake_address?: string | null;
  display_name?: string | null;
  role?: string | null;
};

type Submission = {
  id: string;
  bounty_id?: string | null;
  contributor_id?: string | null;
  content?: string | null;
  status: string;
  feedback?: string | null;
  poster_review_status?: string | null;
  poster_feedback?: string | null;
  created_at?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  paid_at?: string | null;
  transaction_hash?: string | null;
  bounties?: Bounty | Bounty[] | null;
  bounty?: Bounty;
};

type DashboardResponse = {
  role: "admin" | "poster";
  metrics: Record<string, number>;
  queues: {
    bounty_reviews?: Bounty[];
    pending_submissions?: Submission[];
    approved_payouts?: Submission[];
    refund_candidates?: Bounty[];
    non_live_bounties?: Bounty[];
    bounties?: Bounty[];
    pending_submission_reviews?: Submission[];
    submissions?: Submission[];
  };
  recent_activity?: Bounty[];
  error?: string;
};

type AdminTab = "approval" | "submissions" | "bounties";

const adminTabs: Array<{ id: AdminTab; label: string }> = [
  { id: "approval", label: "Approval queue" },
  { id: "submissions", label: "Submission review" },
  { id: "bounties", label: "All bounties" },
];

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
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeStatus(value: string | null | undefined) {
  if (!value) return "Pending";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getSubmissionBounty(submission: Submission) {
  if (submission.bounty) return submission.bounty;
  if (Array.isArray(submission.bounties)) return submission.bounties[0];
  return submission.bounties || null;
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

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(months / 12)}y ago`;
}

function isOlderThanHours(value: string | null | undefined, hours: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() > hours * 60 * 60 * 1000;
}

function groupSubmissionsByBounty(submissions: Submission[]) {
  const groups = new Map<string, { bounty: Bounty | null; submissions: Submission[] }>();

  submissions.forEach((submission) => {
    const bounty = getSubmissionBounty(submission);
    const key = bounty?.id || submission.bounty_id || "unknown";
    const existing = groups.get(key);

    if (existing) {
      existing.submissions.push(submission);
    } else {
      groups.set(key, { bounty, submissions: [submission] });
    }
  });

  return [...groups.values()];
}

function canAdminReviewBounty(bounty: Bounty) {
  return bounty.status === "awaiting_admin_review";
}

function isEscrowVerificationPending(bounty: Bounty) {
  return bounty.status === "pending_escrow" && Boolean(bounty.escrow_tx_hash) && !bounty.escrow_confirmed_at;
}

function getFundingState(bounty: Bounty) {
  if (bounty.escrow_confirmed_at) return "Escrow confirmed";
  if (bounty.escrow_tx_hash) return "Verification pending";
  return "Awaiting escrow";
}

function shortId(value: string | null | undefined) {
  if (!value) return "Unknown";
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function getPosterLabel(bounty: Bounty) {
  return bounty.poster?.display_name || shortId(bounty.poster?.stake_address || bounty.created_by);
}

function getBountyLifecycleNote(bounty: Bounty) {
  if (bounty.status === "rejected") {
    return bounty.refund_tx_hash
      ? `Rejected: refund recorded ${shortId(bounty.refund_tx_hash)}`
      : "Rejected: hidden from public board; refund transaction is required.";
  }

  if (bounty.status === "cancelled" || bounty.status === "expired") {
    return bounty.refund_tx_hash
      ? `Refund recorded ${shortId(bounty.refund_tx_hash)}`
      : `${normalizeStatus(bounty.status)}: refund transaction is required if escrow was funded.`;
  }

  if (bounty.status === "awaiting_admin_review") {
    return "Escrow verified; admin must approve to publish or reject for refund.";
  }

  if (bounty.status === "pending_escrow") {
    if (isEscrowVerificationPending(bounty)) {
      return bounty.escrow_last_checked_at
        ? `Escrow submitted; last verification check ${formatRelativeTime(bounty.escrow_last_checked_at)}.`
        : "Escrow submitted; waiting for on-chain verification.";
    }

    return "Waiting for escrow transaction verification before admin review.";
  }

  if (bounty.status === "open") return "Public bounty accepting submissions.";
  if (bounty.status === "completed") return "Completed bounty; payout has been recorded.";
  return normalizeStatus(bounty.status);
}

function getBountySubmissions(bounty: Bounty | null | undefined) {
  return bounty?.submissions || [];
}

function getSubmissionProgress(bounty: Bounty | null | undefined) {
  const submissions = getBountySubmissions(bounty);
  const accepted = submissions.filter((submission) =>
    ["approved", "paid"].includes(submission.status),
  ).length;
  const total = Math.max(submissions.length, 1);
  return Math.min(100, Math.round((accepted / total) * 100));
}

export function DashboardPage() {
  const { connected, disconnectWallet, isAuthenticated, role, reauthenticate, stakeAddress } = useAppWallet();
  const toast = useToast();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>(() => {
    if (typeof window === "undefined") return "approval";
    const savedTab = window.localStorage.getItem("admin_dashboard_tab") as AdminTab | null;
    return savedTab && adminTabs.some((tab) => tab.id === savedTab) ? savedTab : "approval";
  });
  const [selectedApprovalId, setSelectedApprovalId] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [selectedBountyId, setSelectedBountyId] = useState("");

  const dashboardRole = role === "admin" ? "admin" : "poster";

  const loadDashboard = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch(`/api/dashboard/${dashboardRole}`, {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as DashboardResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load dashboard.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [dashboardRole, isAuthenticated]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    if (!isAuthenticated) {
      return () => window.clearTimeout(initialTimer);
    }

    const timer = window.setInterval(() => {
      void loadDashboard();
    }, 120_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [isAuthenticated, loadDashboard]);

  function updateAdminTab(tab: AdminTab) {
    setActiveAdminTab(tab);
    window.localStorage.setItem("admin_dashboard_tab", tab);
  }

  async function ensureAuth() {
    if (!connected) throw new Error("Connect your wallet first.");
    if (!isAuthenticated) await reauthenticate();
  }

  async function runAction(id: string, action: () => Promise<Response>, successMessage: string) {
    setActionId(id);
    try {
      await ensureAuth();
      const response = await action();
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Action failed.");
      }

      toast.success("Dashboard updated", successMessage);
      await loadDashboard();
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : "Unable to complete action.");
    } finally {
      setActionId("");
    }
  }

  const metrics = useMemo(() => {
    if (!data) return [];
    if (dashboardRole === "admin") {
      return [
        ["Awaiting bounty review", data.metrics.awaiting_bounty_reviews || 0],
        ["Not live bounties", data.metrics.not_live_bounties || 0],
        ["Refund candidates", data.metrics.refund_candidates || 0],
        ["Queued payout value", formatAda(data.metrics.queued_payout_ada || 0)],
      ];
    }

    return [
      ["My bounties", data.metrics.total_bounties || 0],
      ["Open bounties", data.metrics.open_bounties || 0],
      ["Submission reviews", data.metrics.pending_submission_reviews || 0],
      ["Committed rewards", formatAda(data.metrics.committed_ada || 0)],
    ];
  }, [dashboardRole, data]);

  const primaryQueueTitle = dashboardRole === "admin" ? "Bounties ready to approve" : "Submissions awaiting poster review";
  const primaryQueue =
    dashboardRole === "admin" ? data?.queues.bounty_reviews || [] : data?.queues.pending_submission_reviews || [];
  const shellCounts = useMemo(
    () => ({
      pendingBounties: data?.metrics.awaiting_bounty_reviews || 0,
      submissionReviews: data?.metrics.pending_submissions || 0,
      payouts: data?.metrics.approved_payouts || 0,
      disputes: 0,
      posterReviews: data?.metrics.pending_submission_reviews || 0,
    }),
    [data],
  );
  const navGroups = useMemo(
    () =>
      dashboardRole === "admin"
        ? [
            {
              label: "Overview",
              items: [
                { href: "/dashboard", label: "Overview", count: 0 },
                { href: "/dashboard/settings", label: "Profile Settings", count: 0 },
              ],
            },
            {
              label: "Review",
              items: [
                { href: "/dashboard/payouts", label: "Payouts", count: shellCounts.payouts },
              ],
            },
            {
              label: "Manage",
              items: [
                { href: "/dashboard/bounties", label: "Bounties", count: 0 },
                { href: "/dashboard/posters", label: "Posters", count: 0 },
                { href: "/dashboard/hunters", label: "Hunters", count: 0 },
                { href: "/dashboard/disputes", label: "Disputes", count: shellCounts.disputes },
              ],
            },
            {
              label: "System",
              items: [
                { href: "/dashboard/treasury", label: "Treasury", count: 0 },
              ],
            },
          ]
        : [
            {
              label: "Workspace",
              items: [
                { href: "/dashboard", label: "Overview", count: 0 },
                { href: "/post-bounty", label: "Post bounty", count: 0 },
                { href: "/explore", label: "Explore", count: 0 },
                { href: "/dashboard/reviews", label: "Reviews", count: shellCounts.posterReviews },
                { href: "/dashboard/settings", label: "Profile Settings", count: 0 },
              ],
            },
          ],
    [dashboardRole, shellCounts],
  );
  const topbarActionLabel = dashboardRole === "admin" ? "Review queue" : "Post bounty";

  return (
    <main className={styles.dashboardShell}>
      <aside className={styles.sidebar} aria-label="Dashboard navigation">
        <Link className={styles.brand} href="/">
          <Image src="/cardano_bounties_logo.png" alt="Cardano Bounties" width={158} height={62} priority />
        </Link>

        <div className={styles.roleCard}>
          <span>{dashboardRole === "admin" ? "Admin" : "Poster"}</span>
          <strong>{dashboardRole === "admin" ? "Platform operations" : "Project workspace"}</strong>
        </div>

        <nav className={styles.sideNav} aria-label="Dashboard sections">
          {navGroups.map((group) => (
            <section className={styles.navGroup} key={group.label}>
              <span>{group.label}</span>
              {group.items.map((item) => (
                <Link
                  href={item.href}
                  className={item.href === "/dashboard" ? styles.activeNav : undefined}
                  key={item.href}
                >
                  {item.label}
                  {item.count > 0 ? <b>{item.count}</b> : null}
                </Link>
              ))}
            </section>
          ))}
        </nav>

        <div className={styles.walletSlot}>
          {connected ? (
            <div className={styles.shellWallet}>
              <span>Connected wallet</span>
              <strong>{shortId(stakeAddress)}</strong>
              <button type="button" onClick={disconnectWallet}>
                Disconnect
              </button>
            </div>
          ) : (
            <WalletConnect />
          )}
        </div>
      </aside>

      <section className={styles.dashboardMain}>
        <header className={styles.topbar}>
          <div>
            <span className="pill">{dashboardRole === "admin" ? "Admin review" : "Poster review"}</span>
            <h1>{dashboardRole === "admin" ? "Review funded bounties and payouts" : "Manage your bounty pipeline"}</h1>
            <p>
              {dashboardRole === "admin"
                ? "Approve escrow-funded bounties, review submissions, and record payout or refund transactions."
                : "Track bounties you posted, review contributor submissions, and send recommendations to admin review."}
            </p>
          </div>
          <div className={styles.topbarControls} aria-label="Dashboard controls">
            <label>
              <span>Search</span>
              <input type="search" placeholder="Search dashboard" />
            </label>
            <label>
              <span>Filter</span>
              <select defaultValue="all">
                <option value="all">All queues</option>
                <option value="attention">Needs attention</option>
                <option value="funded">Funded</option>
              </select>
            </label>
            <label>
              <span>Date range</span>
              <select defaultValue="30d">
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </label>
            <Link href={dashboardRole === "admin" ? "/dashboard/pending" : "/post-bounty"}>
              {topbarActionLabel}
            </Link>
          </div>
        </header>

        {!connected ? (
          <section className={styles.panel}>
            <div className={styles.emptyState}>
              <h2>Connect wallet to view dashboard</h2>
              <p>Your wallet role determines whether you see admin queues or poster queues.</p>
              <WalletConnect />
            </div>
          </section>
        ) : !isAuthenticated ? (
          <section className={styles.panel}>
            <div className={styles.emptyState}>
              <h2>Sign wallet verification</h2>
              <p>Dashboard actions require an authenticated wallet session.</p>
              <button type="button" onClick={() => void reauthenticate()}>Sign verification</button>
            </div>
          </section>
        ) : isLoading ? (
          <>
            <MetricGridShimmer />
            {dashboardRole === "admin" ? (
              <AdminTableShimmer columns={7} rows={6} />
            ) : (
              <section className={styles.workspaceGrid}>
                <WorkspaceQueueShimmer />
                <HealthPanelShimmer />
              </section>
            )}
          </>
        ) : error ? (
          <section className={styles.panel}>
            <div className={styles.emptyState}>
              <h2>Dashboard unavailable</h2>
              <p>{error}</p>
              <button type="button" onClick={() => void loadDashboard()}>Retry</button>
            </div>
          </section>
        ) : (
          <>
            <section className={styles.metricGrid} aria-label="Dashboard metrics">
              {metrics.map(([label, value]) => (
                <article className={styles.metricCard} key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </article>
              ))}
            </section>

            {dashboardRole === "admin" ? (
              <AdminWorkspace
                actionId={actionId}
                activeTab={activeAdminTab}
                allBounties={data?.queues.bounties || []}
                approvalBounties={data?.queues.bounty_reviews || []}
                selectedApprovalId={selectedApprovalId}
                selectedBountyId={selectedBountyId}
                selectedSubmissionId={selectedSubmissionId}
                setSelectedApprovalId={setSelectedApprovalId}
                setSelectedBountyId={setSelectedBountyId}
                setSelectedSubmissionId={setSelectedSubmissionId}
                submissions={data?.queues.pending_submissions || []}
                updateAdminTab={updateAdminTab}
                runAction={runAction}
              />
            ) : (
              <>
            <section className={styles.workspaceGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <span>Queue</span>
                    <h2>{primaryQueueTitle}</h2>
                  </div>
                  <button type="button" onClick={() => void loadDashboard()}>Refresh</button>
                </div>

                <div className={styles.queueList}>
                  {primaryQueue.length > 0 ? (
                    primaryQueue.map((item) =>
                      false ? (
                        <article className={styles.queueItem} key={(item as Bounty).id}>
                          <div>
                            <h3>{(item as Bounty).title}</h3>
                            <p>Posted by {getPosterLabel(item as Bounty)} · {getFundingState(item as Bounty)}</p>
                            <small className={styles.lifecycleNote}>{getBountyLifecycleNote(item as Bounty)}</small>
                          </div>
                          <span>{formatAda((item as Bounty).reward_amount)}</span>
                          <BountyReviewActions bounty={item as Bounty} actionId={actionId} runAction={runAction} />
                        </article>
                      ) : (
                        <article className={styles.queueItem} key={(item as Submission).id}>
                          <div>
                            <h3>{getSubmissionBounty(item as Submission)?.title || "Submission"}</h3>
                            <p>{(item as Submission).content || "No submission notes"}</p>
                          </div>
                          <span>{normalizeStatus((item as Submission).poster_review_status)}</span>
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              disabled={actionId === `${(item as Submission).id}:recommended_approval`}
                              onClick={() =>
                                void runAction(
                                  `${(item as Submission).id}:recommended_approval`,
                                  () =>
                                    authFetch(`/api/submissions/${(item as Submission).id}/poster-review`, {
                                      method: "PATCH",
                                      body: JSON.stringify({ status: "recommended_approval" }),
                                    }),
                                  "Submission recommended for admin approval.",
                                )
                              }
                            >
                              Recommend
                            </button>
                            <button
                              type="button"
                              disabled={actionId === `${(item as Submission).id}:changes_requested`}
                              onClick={() =>
                                void runAction(
                                  `${(item as Submission).id}:changes_requested`,
                                  () =>
                                    authFetch(`/api/submissions/${(item as Submission).id}/poster-review`, {
                                      method: "PATCH",
                                      body: JSON.stringify({ status: "changes_requested" }),
                                    }),
                                  "Submission marked for changes.",
                                )
                              }
                            >
                              Changes
                            </button>
                          </div>
                        </article>
                      ),
                    )
                  ) : (
                    <div className={styles.emptyState}>
                      <h2>No items waiting</h2>
                      <p>The current review queue is clear.</p>
                    </div>
                  )}
                </div>
              </div>

              <aside className={styles.healthPanel}>
                <span>Operational health</span>
                <strong>{primaryQueue.length === 0 ? "Clear" : primaryQueue.length}</strong>
                <div className={styles.progressTrack} aria-hidden="true">
                  <i style={{ width: primaryQueue.length === 0 ? "100%" : "54%" }} />
                </div>
                <p>
                  Poster review recommendations help admin process submissions and payouts faster.
                </p>
              </aside>
            </section>

              <section className={styles.tablePanel}>
                <div className={styles.panelHeader}>
                  <div>
                    <span>Bounties</span>
                    <h2>My posted bounties</h2>
                  </div>
                </div>
                <BountyTable
                  actionId={actionId}
                  bounties={data?.queues.bounties || []}
                  runAction={runAction}
                />
              </section>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function AdminWorkspace({
  actionId,
  activeTab,
  allBounties,
  approvalBounties,
  selectedApprovalId,
  selectedBountyId,
  selectedSubmissionId,
  setSelectedApprovalId,
  setSelectedBountyId,
  setSelectedSubmissionId,
  submissions,
  updateAdminTab,
  runAction,
}: {
  actionId: string;
  activeTab: AdminTab;
  allBounties: Bounty[];
  approvalBounties: Bounty[];
  selectedApprovalId: string;
  selectedBountyId: string;
  selectedSubmissionId: string;
  setSelectedApprovalId: (id: string) => void;
  setSelectedBountyId: (id: string) => void;
  setSelectedSubmissionId: (id: string) => void;
  submissions: Submission[];
  updateAdminTab: (tab: AdminTab) => void;
  runAction: (id: string, action: () => Promise<Response>, successMessage: string) => Promise<void>;
}) {
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [adminNote, setAdminNote] = useState("");
  const sortedApprovalBounties = useMemo(
    () =>
      [...approvalBounties].sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
      ),
    [approvalBounties],
  );
  const groupedSubmissions = useMemo(() => groupSubmissionsByBounty(submissions), [submissions]);
  const visibleBounties = useMemo(
    () =>
      statusFilters.length > 0
        ? allBounties.filter((bounty) => statusFilters.includes(bounty.status))
        : allBounties,
    [allBounties, statusFilters],
  );

  const selectedApproval = sortedApprovalBounties.find((bounty) => bounty.id === selectedApprovalId) || null;
  const selectedSubmission = submissions.find((submission) => submission.id === selectedSubmissionId) || null;
  const selectedBounty = visibleBounties.find((bounty) => bounty.id === selectedBountyId) || null;
  const statuses = [...new Set(allBounties.map((bounty) => bounty.status))];

  function toggleStatusFilter(status: string) {
    setStatusFilters((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status],
    );
  }

  return (
    <section className={styles.adminWorkspace} aria-label="Admin workspace">
      <div className={styles.workspaceTabs} role="tablist" aria-label="Admin review tabs">
        {adminTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? styles.activeWorkspaceTab : undefined}
            key={tab.id}
            role="tab"
            type="button"
            onClick={() => updateAdminTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.reviewWorkspace}>
        <aside className={styles.reviewListPane}>
          {activeTab === "approval" ? (
            <>
              <div className={styles.listPaneHeader}>
                <span>Oldest first</span>
                <strong>{sortedApprovalBounties.length} pending</strong>
              </div>
              <div className={styles.reviewList}>
                {sortedApprovalBounties.length > 0 ? (
                  sortedApprovalBounties.map((bounty) => (
                    <button
                      className={selectedApprovalId === bounty.id ? styles.selectedReviewRow : undefined}
                      key={bounty.id}
                      type="button"
                      onClick={() => setSelectedApprovalId(bounty.id)}
                    >
                      <strong>{bounty.title}</strong>
                      <span>{formatAda(bounty.reward_amount)} · {shortId(bounty.poster?.stake_address || bounty.created_by)}</span>
                      <small>
                        {formatRelativeTime(bounty.created_at)}
                        {isOlderThanHours(bounty.created_at, 24) ? " · urgent" : ""}
                      </small>
                    </button>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <h2>No bounty approvals</h2>
                    <p>Funded bounty approvals will appear here.</p>
                  </div>
                )}
              </div>
            </>
          ) : null}

          {activeTab === "submissions" ? (
            <div className={styles.submissionReviewList}>
              {groupedSubmissions.length > 0 ? (
                groupedSubmissions.map((group) => (
                  <section key={group.bounty?.id || group.submissions[0]?.bounty_id || "unknown"}>
                    <header>{group.bounty?.title || "Unlinked bounty"}</header>
                    {group.submissions.map((submission) => (
                      <button
                        className={selectedSubmissionId === submission.id ? styles.selectedReviewRow : undefined}
                        key={submission.id}
                        type="button"
                        onClick={() => setSelectedSubmissionId(submission.id)}
                      >
                        <strong>{shortId(submission.contributor_id)}</strong>
                        <span>{formatRelativeTime(submission.submitted_at || submission.created_at)}</span>
                        <small>Poster {normalizeStatus(submission.poster_review_status)}</small>
                      </button>
                    ))}
                  </section>
                ))
              ) : (
                <div className={styles.emptyState}>
                  <h2>No submissions</h2>
                  <p>Poster-approved submissions will appear here for final review.</p>
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "bounties" ? (
            <>
              <div className={styles.statusFilters}>
                {statuses.map((status) => (
                  <button
                    className={statusFilters.includes(status) ? styles.selectedStatusFilter : undefined}
                    key={status}
                    type="button"
                    onClick={() => toggleStatusFilter(status)}
                  >
                    {normalizeStatus(status)}
                  </button>
                ))}
              </div>
              <div className={styles.reviewList}>
                {visibleBounties.length > 0 ? (
                  visibleBounties.map((bounty) => (
                    <button
                      className={selectedBountyId === bounty.id ? styles.selectedReviewRow : undefined}
                      key={bounty.id}
                      type="button"
                      onClick={() => setSelectedBountyId(bounty.id)}
                    >
                      <strong>{bounty.title}</strong>
                      <span>{formatAda(bounty.reward_amount)} · {normalizeStatus(bounty.status)}</span>
                      <small>{getBountySubmissions(bounty).length} submissions</small>
                      <i aria-hidden="true">
                        <b style={{ width: `${getSubmissionProgress(bounty)}%` }} />
                      </i>
                    </button>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <h2>No matching bounties</h2>
                    <p>Clear status filters to show every bounty.</p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </aside>

        <section className={styles.reviewDetailPane}>
          {activeTab === "approval" ? (
            <ApprovalDetail bounty={selectedApproval} actionId={actionId} runAction={runAction} />
          ) : null}
          {activeTab === "submissions" ? (
            <SubmissionReviewDetail
              actionId={actionId}
              adminNote={adminNote}
              setAdminNote={setAdminNote}
              submission={selectedSubmission}
              runAction={runAction}
            />
          ) : null}
          {activeTab === "bounties" ? (
            <AllBountyDetail bounty={selectedBounty} updateAdminTab={updateAdminTab} />
          ) : null}
        </section>
      </div>
    </section>
  );
}

function DetailEmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className={styles.detailEmptyState}>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

function ApprovalDetail({
  bounty,
  actionId,
  runAction,
}: {
  bounty: Bounty | null;
  actionId: string;
  runAction: (id: string, action: () => Promise<Response>, successMessage: string) => Promise<void>;
}) {
  if (!bounty) {
    return <DetailEmptyState title="Select a bounty" message="Choose a funded bounty from the approval queue." />;
  }

  return (
    <div className={styles.detailStack}>
      <section className={styles.detailSection}>
        <div className={styles.detailTitleRow}>
          <div>
            <span>{normalizeStatus(bounty.status)}</span>
            <h2>{bounty.title}</h2>
          </div>
          <strong>{formatAda(bounty.reward_amount)}</strong>
        </div>
        <p>{bounty.type || "General"} · locked in escrow</p>
        {bounty.escrow_tx_hash ? (
          <a href={`https://preprod.cardanoscan.io/transaction/${bounty.escrow_tx_hash}`} rel="noreferrer" target="_blank">
            {shortId(bounty.escrow_tx_hash)}
          </a>
        ) : null}
      </section>

      <section className={styles.detailSection}>
        <span>Description</span>
        <p>{bounty.description || "No description provided."}</p>
      </section>

      <section className={styles.detailGrid}>
        <div><span>Reward</span><strong>{formatAda(bounty.reward_amount)}</strong></div>
        <div><span>Deadline</span><strong>{formatDate(bounty.created_at)}</strong></div>
        <div><span>Escrow</span><strong>{getFundingState(bounty)}</strong></div>
        <div><span>Poster</span><strong>{shortId(bounty.poster?.stake_address || bounty.created_by)}</strong></div>
      </section>

      <section className={styles.detailSection}>
        <span>Admin checklist</span>
        <label><input type="checkbox" /> Scope is clear</label>
        <label><input type="checkbox" /> Reward matches effort</label>
        <label><input type="checkbox" /> Escrow transaction is present</label>
        <label><input type="checkbox" /> Public brief is safe</label>
        <label><input type="checkbox" /> Instructions are actionable</label>
      </section>

      <div className={styles.detailActionBar}>
        <button
          type="button"
          disabled={actionId === `${bounty.id}:rejected`}
          onClick={() =>
            void runAction(
              `${bounty.id}:rejected`,
              () =>
                authFetch(`/api/bounties/${bounty.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ status: "rejected" }),
                }),
              "Bounty rejected.",
            )
          }
        >
          Reject
        </button>
        <button type="button">Message poster</button>
        <button
          type="button"
          disabled={actionId === `${bounty.id}:open`}
          onClick={() =>
            void runAction(
              `${bounty.id}:open`,
              () =>
                authFetch(`/api/bounties/${bounty.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ status: "open" }),
                }),
              "Bounty approved and opened.",
            )
          }
        >
          Approve
        </button>
      </div>
    </div>
  );
}

function SubmissionReviewDetail({
  actionId,
  adminNote,
  setAdminNote,
  submission,
  runAction,
}: {
  actionId: string;
  adminNote: string;
  setAdminNote: (value: string) => void;
  submission: Submission | null;
  runAction: (id: string, action: () => Promise<Response>, successMessage: string) => Promise<void>;
}) {
  const bounty = submission ? getSubmissionBounty(submission) : null;

  if (!submission) {
    return <DetailEmptyState title="Select a submission" message="Choose a contributor submission for final admin review." />;
  }

  return (
    <div className={styles.detailStack}>
      <div className={styles.stepStrip} aria-label="Submission progress">
        <span>Hunter submits</span>
        <span>Poster reviews</span>
        <span>Admin final review</span>
        <span>Payout</span>
      </div>
      <section className={styles.detailSection}>
        <span>{bounty?.title || "Unlinked bounty"}</span>
        <h2>{shortId(submission.contributor_id)}</h2>
        <p>{formatRelativeTime(submission.submitted_at || submission.created_at)}</p>
      </section>
      <section className={styles.detailSection}>
        <span>Submission content</span>
        <p>{submission.content || "No submission content provided."}</p>
      </section>
      <section className={styles.noticeSection}>
        <span>Poster review note</span>
        <p>{submission.poster_feedback || normalizeStatus(submission.poster_review_status)}</p>
      </section>
      <section className={styles.detailSection}>
        <label htmlFor="admin-note">Admin note</label>
        <textarea
          id="admin-note"
          placeholder="Add an internal note for this final review."
          value={adminNote}
          onChange={(event) => setAdminNote(event.target.value)}
        />
      </section>
      <div className={styles.detailActionBar}>
        <button
          type="button"
          disabled={actionId === `${submission.id}:reject`}
          onClick={() =>
            void runAction(
              `${submission.id}:reject`,
              () =>
                authFetch(`/api/submissions/${submission.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ status: "rejected", feedback: adminNote }),
                }),
              "Submission rejected.",
            )
          }
        >
          Reject
        </button>
        <button type="button">Dispute</button>
        <button
          type="button"
          disabled={actionId === `${submission.id}:approve`}
          onClick={() =>
            void runAction(
              `${submission.id}:approve`,
              () =>
                authFetch(`/api/submissions/${submission.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ status: "approved", feedback: adminNote }),
                }),
              "Submission approved for payout.",
            )
          }
        >
          Approve
        </button>
      </div>
    </div>
  );
}

function AllBountyDetail({
  bounty,
  updateAdminTab,
}: {
  bounty: Bounty | null;
  updateAdminTab: (tab: AdminTab) => void;
}) {
  if (!bounty) {
    return <DetailEmptyState title="Select a bounty" message="Choose a bounty to inspect its lifecycle and submissions." />;
  }

  const submissions = getBountySubmissions(bounty);
  const approved = submissions.filter((submission) => ["approved", "paid"].includes(submission.status)).length;
  const pending = submissions.filter((submission) => submission.status === "pending").length;
  const rejected = submissions.filter((submission) => submission.status === "rejected").length;

  return (
    <div className={styles.detailStack}>
      <section className={styles.detailSection}>
        <div className={styles.detailTitleRow}>
          <div>
            <span>{normalizeStatus(bounty.status)}</span>
            <h2>{bounty.title}</h2>
          </div>
          <strong>{formatAda(bounty.reward_amount)}</strong>
        </div>
        <div className={styles.progressTrack} aria-label={`${getSubmissionProgress(bounty)} percent accepted`}>
          <i style={{ width: `${getSubmissionProgress(bounty)}%` }} />
        </div>
      </section>
      <section className={styles.detailGrid}>
        <div><span>Poster</span><strong>{shortId(bounty.poster?.stake_address || bounty.created_by)}</strong></div>
        <div><span>Posted</span><strong>{formatDate(bounty.created_at)}</strong></div>
        <div><span>Deadline</span><strong>{formatDate(bounty.created_at)}</strong></div>
        <div><span>Escrow tx</span><strong>{shortId(bounty.escrow_tx_hash)}</strong></div>
      </section>
      <section className={styles.detailSection}>
        <span>Submission breakdown</span>
        <button type="button" onClick={() => updateAdminTab("submissions")}>Pending: {pending}</button>
        <button type="button" onClick={() => updateAdminTab("submissions")}>Approved: {approved}</button>
        <button type="button" onClick={() => updateAdminTab("submissions")}>Rejected: {rejected}</button>
      </section>
      <section className={styles.timeline}>
        <span>Lifecycle</span>
        <p><i /> Created {formatRelativeTime(bounty.created_at)}</p>
        <p><i /> Escrow {bounty.escrow_confirmed_at ? `confirmed ${formatRelativeTime(bounty.escrow_confirmed_at)}` : getFundingState(bounty)}</p>
        <p><i /> Status {normalizeStatus(bounty.status)}</p>
      </section>
      <div className={styles.detailActionBar}>
        <button type="button">Close bounty</button>
        <button type="button">Edit</button>
        <button type="button" onClick={() => updateAdminTab("submissions")}>Review submissions</button>
      </div>
    </div>
  );
}

function BountyTable({
  actionId,
  bounties,
  runAction,
}: {
  actionId: string;
  bounties: Bounty[];
  runAction: (id: string, action: () => Promise<Response>, successMessage: string) => Promise<void>;
}) {
  return (
    <div className={styles.activityTable} role="table" aria-label="Posted bounties">
      <div className={styles.tableHead} role="row">
        <span role="columnheader">Bounty</span>
        <span role="columnheader">Reward</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Updated</span>
      </div>
      {bounties.map((bounty) => (
        <div className={styles.tableRow} role="row" key={bounty.id}>
          <span role="cell" data-label="Bounty">{bounty.title}</span>
          <span role="cell" data-label="Reward">{formatAda(bounty.reward_amount)}</span>
          <span role="cell" data-label="Status">
            <b>{isEscrowVerificationPending(bounty) ? "Escrow Verification Pending" : normalizeStatus(bounty.status)}</b>
            {bounty.escrow_verification_error ? <small>{bounty.escrow_verification_error}</small> : null}
            {isEscrowVerificationPending(bounty) ? (
              <button
                type="button"
                disabled={actionId === `${bounty.id}:verify-escrow`}
                onClick={() =>
                  void runAction(
                    `${bounty.id}:verify-escrow`,
                    () =>
                      authFetch(`/api/bounties/${bounty.id}/escrow/verify`, {
                        method: "POST",
                      }),
                    "Escrow verification checked.",
                  )
                }
              >
                {actionId === `${bounty.id}:verify-escrow` ? "Checking..." : "Retry verification"}
              </button>
            ) : null}
          </span>
          <span role="cell" data-label="Updated">{formatDate(bounty.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

function BountyReviewActions({
  bounty,
  actionId,
  runAction,
}: {
  bounty: Bounty;
  actionId: string;
  runAction: (id: string, action: () => Promise<Response>, successMessage: string) => Promise<void>;
}) {
  const reviewReady = canAdminReviewBounty(bounty);

  return (
    <div className={styles.rowActions}>
      <button
        type="button"
        disabled={!reviewReady || actionId === `${bounty.id}:open`}
        title={reviewReady ? "Approve and publish bounty" : "Bounty must have confirmed escrow before approval"}
        onClick={() =>
          void runAction(
            `${bounty.id}:open`,
            () =>
              authFetch(`/api/bounties/${bounty.id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "open" }),
              }),
            "Bounty approved and opened.",
          )
        }
      >
        Approve
      </button>
      <button
        type="button"
        disabled={!reviewReady || actionId === `${bounty.id}:rejected`}
        title={reviewReady ? "Reject bounty" : "Bounty must be in admin review before rejection"}
        onClick={() =>
          void runAction(
            `${bounty.id}:rejected`,
            () =>
              authFetch(`/api/bounties/${bounty.id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "rejected" }),
              }),
            "Bounty rejected.",
          )
        }
      >
        Reject
      </button>
    </div>
  );
}

function SubmissionTable({
  submissions,
  actionId,
  runAction,
}: {
  submissions: Submission[];
  actionId: string;
  runAction: (id: string, action: () => Promise<Response>, successMessage: string) => Promise<void>;
}) {
  const groupedSubmissions = groupSubmissionsByBounty(submissions);

  if (submissions.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h2>No pending submissions</h2>
        <p>There are no contributor submissions waiting for admin review.</p>
      </div>
    );
  }

  return (
    <div className={styles.submissionGroups}>
      {groupedSubmissions.map((group) => (
        <section className={styles.submissionGroup} key={group.bounty?.id || group.submissions[0]?.bounty_id || "unknown"}>
          <header className={styles.submissionGroupHeader}>
            <div>
              <h3>{group.bounty?.title || "Unlinked bounty"}</h3>
              <p>
                {formatAda(group.bounty?.reward_amount)} · {group.submissions.length} pending submission
                {group.submissions.length === 1 ? "" : "s"}
              </p>
            </div>
            <b>{normalizeStatus(group.bounty?.status)}</b>
          </header>

          <div className={`${styles.activityTable} ${styles.submissionTable}`} role="table" aria-label={`${group.bounty?.title || "Bounty"} pending submissions`}>
            <div className={styles.tableHead} role="row">
              <span role="columnheader">Contributor</span>
              <span role="columnheader">Poster Rec.</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Action</span>
            </div>
            {group.submissions.map((submission) => (
              <div className={styles.tableRow} role="row" key={submission.id}>
                <span role="cell" data-label="Contributor">
                  <strong>{shortId(submission.contributor_id)}</strong>
                  <small>{submission.content || "No submission notes"}</small>
                </span>
                <span role="cell" data-label="Poster Rec.">{normalizeStatus(submission.poster_review_status)}</span>
                <span role="cell" data-label="Status"><b>{normalizeStatus(submission.status)}</b></span>
                <span role="cell" data-label="Action" className={styles.tableActions}>
                  <button
                    type="button"
                    disabled={actionId === `${submission.id}:approve`}
                    onClick={() =>
                      void runAction(
                        `${submission.id}:approve`,
                        () =>
                          authFetch(`/api/submissions/${submission.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: "approved" }),
                          }),
                        "Submission approved for payout.",
                      )
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={actionId === `${submission.id}:reject`}
                    onClick={() =>
                      void runAction(
                        `${submission.id}:reject`,
                        () =>
                          authFetch(`/api/submissions/${submission.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: "rejected" }),
                          }),
                        "Submission rejected.",
                      )
                    }
                  >
                    Reject
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
