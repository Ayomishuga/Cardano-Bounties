"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WalletConnect } from "@/components/wallet/WalletConnect";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAppWallet } from "@/components/wallet/WalletProvider";
import { authFetch } from "@/lib/api";
import styles from "@/app/pages/DashboardPage.module.css";

type DashboardCounts = {
  metrics?: Record<string, number>;
  error?: string;
};

const pageMeta: Record<string, { eyebrow: string; title: string; description: string; action: string; href: string }> = {
  "/dashboard": {
    eyebrow: "Admin operations",
    title: "Operations workspace",
    description: "Process bounty approvals, submission reviews, payouts, refunds, and treasury exposure.",
    action: "Open bounties",
    href: "/dashboard/bounties",
  },
  "/dashboard/approvals": {
    eyebrow: "Review",
    title: "Bounty approvals",
    description: "Review escrow-funded bounty posts before they go live on the public board.",
    action: "Submissions",
    href: "/dashboard/submissions",
  },
  "/dashboard/submissions": {
    eyebrow: "Review",
    title: "Submission approvals",
    description: "Run final admin review on poster-approved bounty submissions.",
    action: "Payouts",
    href: "/dashboard/payouts",
  },
  "/dashboard/bounties": {
    eyebrow: "Manage",
    title: "All bounties",
    description: "Browse bounty status, reward value, poster identity, deadlines, and submission volume.",
    action: "Workspace",
    href: "/dashboard",
  },
  "/dashboard/posters": {
    eyebrow: "Manage",
    title: "Posters",
    description: "Review bounty creators by wallet, posting volume, approval rate, and active bounty count.",
    action: "Workspace",
    href: "/dashboard",
  },
  "/dashboard/hunters": {
    eyebrow: "Manage",
    title: "Hunters",
    description: "Track contributor submission volume, accepted work, earned ADA, and recent activity.",
    action: "Workspace",
    href: "/dashboard",
  },
  "/dashboard/payouts": {
    eyebrow: "Treasury ops",
    title: "Payouts",
    description: "Review approved submissions that need payout transaction handling.",
    action: "Treasury",
    href: "/dashboard/treasury",
  },
  "/dashboard/refunds": {
    eyebrow: "Treasury ops",
    title: "Refunds",
    description: "Track rejected, cancelled, or expired funded bounties that need refund handling.",
    action: "Treasury",
    href: "/dashboard/treasury",
  },
  "/dashboard/disputes": {
    eyebrow: "Manage",
    title: "Disputes",
    description: "Review dispute records once dispute intake is connected.",
    action: "Workspace",
    href: "/dashboard",
  },
  "/dashboard/treasury": {
    eyebrow: "System",
    title: "Treasury",
    description: "Monitor committed bounty funds, queued payout value, and refund exposure.",
    action: "Payouts",
    href: "/dashboard/payouts",
  },
  "/dashboard/settings": {
    eyebrow: "Account settings",
    title: "Profile settings",
    description: "Customize your display name and bio details linked to your Cardano stake key.",
    action: "Overview",
    href: "/dashboard",
  },
  "/dashboard/reviews": {
    eyebrow: "Poster workspace",
    title: "Submission reviews",
    description: "Review contributor submissions for your bounties and recommend them to admin or request changes.",
    action: "Overview",
    href: "/dashboard",
  },
  "/dashboard/contributions": {
    eyebrow: "Contributor workspace",
    title: "My contributions",
    description: "Track bounties you applied for, review status, payout allocation, and payment progress.",
    action: "Explore bounties",
    href: "/explore",
  },
};

/** Paths that poster-role users are allowed to access inside the dashboard shell */
const POSTER_ALLOWED_PATHS = new Set([
  "/dashboard",
  "/dashboard/bounties",
  "/dashboard/settings",
  "/dashboard/reviews",
  "/dashboard/contributions",
]);

function shortId(value: string | null | undefined) {
  if (!value) return "Unknown";
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function getNavGroups(metrics: Record<string, number>, role: string) {
  if (role === "admin") {
    return [
      { label: "Overview", items: [{ href: "/dashboard", label: "Operations", count: 0 }] },
      {
        label: "Review",
        items: [
          { href: "/dashboard/approvals", label: "Approvals", count: metrics.awaiting_bounty_reviews || 0 },
          { href: "/dashboard/submissions", label: "Submissions", count: metrics.pending_submissions || 0 },
          { href: "/dashboard/payouts", label: "Payouts", count: metrics.approved_payouts || 0 },
          { href: "/dashboard/refunds", label: "Refunds", count: metrics.refund_candidates || 0 },
        ],
      },
      {
        label: "Manage",
        items: [
          { href: "/dashboard/bounties", label: "Bounties", count: 0 },
          { href: "/dashboard/posters", label: "Posters", count: 0 },
          { href: "/dashboard/hunters", label: "Hunters", count: 0 },
          { href: "/dashboard/disputes", label: "Disputes", count: 0 },
        ],
      },
      { label: "System", items: [{ href: "/dashboard/treasury", label: "Treasury", count: 0 }] },
    ];
  }

  // Poster nav
  return [
    {
      label: "Workspace",
      items: [
        { href: "/dashboard", label: "Overview", count: 0 },
        { href: "/dashboard/bounties", label: "My bounties", count: metrics.total_bounties || 0 },
        { href: "/post-bounty", label: "Post bounty", count: 0 },
        { href: "/explore", label: "Explore", count: 0 },
        { href: "/dashboard/reviews", label: "Reviews", count: metrics.pending_submission_reviews || 0 },
        { href: "/dashboard/contributions", label: "My contributions", count: metrics.total_submissions || 0 },
        { href: "/dashboard/settings", label: "Profile Settings", count: 0 },
      ],
    },
  ];
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { connected, disconnectWallet, isAuthenticated, reauthenticate, role, stakeAddress } = useAppWallet();
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

  const loadCounts = useCallback(async () => {
    if (!isAuthenticated || !role) return;
    setIsLoadingCounts(true);
    try {
      if (role === "admin") {
        const response = await authFetch("/api/dashboard/admin", { headers: { Accept: "application/json" } });
        const payload = (await response.json()) as DashboardCounts;
        if (response.ok) setCounts(payload);
        return;
      }

      const [posterResponse, contributorResponse] = await Promise.all([
        authFetch("/api/dashboard/poster", { headers: { Accept: "application/json" } }),
        authFetch("/api/dashboard/contributor", { headers: { Accept: "application/json" } }),
      ]);
      const posterPayload = (await posterResponse.json().catch(() => ({}))) as DashboardCounts;
      const contributorPayload = (await contributorResponse.json().catch(() => ({}))) as DashboardCounts;

      setCounts({
        metrics: {
          ...(posterResponse.ok ? posterPayload.metrics : {}),
          ...(contributorResponse.ok ? contributorPayload.metrics : {}),
        },
      });
    } finally {
      setIsLoadingCounts(false);
    }
  }, [isAuthenticated, role]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void loadCounts();
    }, 0);

    if (!isAuthenticated) {
      return () => window.clearTimeout(initialTimer);
    }

    const timer = window.setInterval(() => {
      void loadCounts();
    }, 120_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [isAuthenticated, loadCounts]);

  const navGroups = useMemo(() => getNavGroups(counts?.metrics || {}, role || ""), [counts, role]);

  const baseMeta = pageMeta[pathname] ?? pageMeta["/dashboard"];
  // For the dashboard home, show role-appropriate eyebrow/title
  const meta = role !== "admin"
    ? pathname === "/dashboard"
      ? {
          eyebrow: "Poster workspace",
          title: "Overview",
          description: "Track bounties you posted, review contributor submissions, and follow your own contributions.",
          action: "Post bounty",
          href: "/post-bounty",
        }
      : pathname === "/dashboard/bounties"
        ? {
            eyebrow: "Poster workspace",
            title: "My bounties",
            description: "Manage posted bounties, funding verification, submission activity, and lifecycle status.",
            action: "Post bounty",
            href: "/post-bounty",
          }
        : baseMeta
    : baseMeta;


  // Determine if this poster-role user is allowed on this path
  const isPosterAllowed = role !== "admin" && POSTER_ALLOWED_PATHS.has(pathname);
  const isAdminPath = role === "admin";
  const isAllowed = isAdminPath || isPosterAllowed;

  return (
    <main className={styles.dashboardShell}>
      <aside className={styles.sidebar} aria-label="Dashboard navigation">
        <Link className={styles.brand} href="/">
          <Image src="/cardano_bounties_logo.png" alt="Cardano Bounties" width={158} height={62} priority />
        </Link>

        <div className={styles.roleCard}>
          <span>{role === "admin" ? "Admin" : "Poster"}</span>
          <strong>{role === "admin" ? (isLoadingCounts ? "Syncing operations" : "Platform operations") : "Project workspace"}</strong>
        </div>

        <nav className={styles.sideNav} aria-label="Dashboard sections">
          {navGroups.map((group) => (
            <section className={styles.navGroup} key={group.label}>
              <span>{group.label}</span>
              {group.items.map((item) => (
                <Link
                  href={item.href}
                  className={pathname === item.href ? styles.activeNav : undefined}
                  key={`${group.label}-${item.label}`}
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
              <button type="button" onClick={disconnectWallet}>Disconnect</button>
            </div>
          ) : (
            <WalletConnect />
          )}
        </div>
      </aside>

      <section className={styles.dashboardMain}>
        {/* ── Sticky top nav bar ── */}
        <div className={styles.topnav}>
          <div className={styles.topnavLeft}>
            <div className={styles.topnavBreadcrumb}>
              <span>{role === "admin" ? "Admin" : "Poster"}</span>
              <span className={styles.topnavSep}>/</span>
              <strong>{meta.title}</strong>
            </div>
          </div>

          <div className={styles.topnavRight}>
            <NotificationBell />
            <ThemeToggle />
            <Link href={meta.href} className={styles.topnavAction}>
              {meta.action}
            </Link>
          </div>
        </div>

        {/* ── Main content area ── */}
        <div className={styles.dashboardContent}>
          {!connected ? (
            <section className={styles.panel}>
              <div className={styles.emptyState}>
                <h2>Connect wallet to view dashboard</h2>
                <p>Dashboard operations require a connected wallet.</p>
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
          ) : !isAllowed ? (
            <section className={styles.panel}>
              <div className={styles.emptyState}>
                <h2>Admin access required</h2>
                <p>This dashboard workspace is only available to admin wallets.</p>
              </div>
            </section>
          ) : (
            <>
              <header className={styles.topbar}>
                <span className="pill">{meta.eyebrow}</span>
                <h1>{meta.title}</h1>
                <p>{meta.description}</p>
              </header>
              {children}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
