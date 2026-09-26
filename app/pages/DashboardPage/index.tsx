"use client";

import Image from "next/image";
import Link from "next/link";
import { WalletConnect } from "@/components/wallet/WalletConnect";
import {
  MetricGridShimmer,
  WorkspaceQueueShimmer,
  HealthPanelShimmer,
  AdminTableShimmer,
} from "@/components/dashboard/ShimmerLoaders";
import { shortId } from "@/lib/formatters";
import { useDashboardData } from "./useDashboardData";
import { AdminWorkspace } from "./AdminWorkspace";
import { PosterWorkspace } from "./PosterWorkspace";
import styles from "../DashboardPage.module.css";

export function DashboardPage() {
  const {
    connected,
    disconnectWallet,
    isAuthenticated,
    reauthenticate,
    stakeAddress,
    dashboardRole,
    data,
    isLoading,
    error,
    actionId,
    loadDashboard,
    runAction,
    metrics,
    navGroups,
    activeAdminTab,
    updateAdminTab,
    selectedApprovalId,
    setSelectedApprovalId,
    selectedSubmissionId,
    setSelectedSubmissionId,
    selectedBountyId,
    setSelectedBountyId,
  } = useDashboardData();

  const topbarActionLabel = dashboardRole === "admin" ? "Review queue" : "Post bounty";
  const primaryQueueTitle =
    dashboardRole === "admin" ? "Bounties ready to approve" : "Submissions awaiting poster review";
  const primaryQueue =
    dashboardRole === "admin"
      ? data?.queues.bounty_reviews || []
      : data?.queues.pending_submission_reviews || [];

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
              <PosterWorkspace
                primaryQueue={primaryQueue}
                primaryQueueTitle={primaryQueueTitle}
                actionId={actionId}
                runAction={runAction}
                loadDashboard={loadDashboard}
                bounties={data?.queues.bounties || []}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default DashboardPage;
