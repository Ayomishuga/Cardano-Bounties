"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/api";
import { formatAda } from "@/lib/formatters";
import styles from "./DashboardPage.module.css";
import { AdminOperationsShimmer } from "@/components/dashboard/ShimmerLoaders";

type DashboardResponse = {
  metrics: Record<string, number>;
  error?: string;
};

export function AdminOperationsPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/dashboard/admin", { headers: { Accept: "application/json" } });
      const payload = (await response.json()) as DashboardResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load operations.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load operations.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const operations = useMemo(
    () => [
      {
        title: "Bounty approvals",
        description: "Funded bounty posts waiting for admin approval before becoming public.",
        count: data?.metrics.awaiting_bounty_reviews || 0,
        href: "/dashboard/approvals",
        action: "Review approvals",
      },
      {
        title: "Submission approvals",
        description: "Contributor submissions that need final admin review after poster recommendation.",
        count: data?.metrics.pending_submissions || 0,
        href: "/dashboard/submissions",
        action: "Review submissions",
      },
      {
        title: "Payouts",
        description: "Approved submissions waiting for payout transaction hash recording.",
        count: data?.metrics.approved_payouts || 0,
        href: "/dashboard/payouts",
        action: "Handle payouts",
      },
      {
        title: "Refunds",
        description: "Rejected, cancelled, or expired funded bounties that may need refund recording.",
        count: data?.metrics.refund_candidates || 0,
        href: "/dashboard/refunds",
        action: "Handle refunds",
      },
    ],
    [data],
  );

  if (isLoading) {
    return <AdminOperationsShimmer />;
  }

  if (error) {
    return (
      <section className={styles.panel}>
        <div className={styles.emptyState}>
          <h2>Could not load operations</h2>
          <p>{error}</p>
          <button type="button" onClick={() => void loadDashboard()}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className={styles.operationGrid} aria-label="Admin operation modes">
        {operations.map((operation) => (
          <article className={styles.operationCard} key={operation.title}>
            <div>
              <span>{operation.title}</span>
              <strong>{operation.count}</strong>
              <p>{operation.description}</p>
            </div>
            <Link href={operation.href}>{operation.action}</Link>
          </article>
        ))}
      </section>

      <section className={styles.managementPanel}>
        <div className={styles.panelHeader}>
          <div>
            <span>Treasury snapshot</span>
            <h2>Operational exposure</h2>
            <p>These numbers help decide whether the next action is review work, payout work, or refund cleanup.</p>
          </div>
          <Link href="/dashboard/treasury">Open treasury</Link>
        </div>
        <div className={styles.operationSummaryGrid}>
          <div>
            <span>Queued payout value</span>
            <strong>{formatAda(data?.metrics.queued_payout_ada || 0)}</strong>
          </div>
          <div>
            <span>Open bounties</span>
            <strong>{data?.metrics.open_bounties || 0}</strong>
          </div>
          <div>
            <span>Pending escrow</span>
            <strong>{data?.metrics.pending_escrow_bounties || 0}</strong>
          </div>
          <div>
            <span>Not live</span>
            <strong>{data?.metrics.not_live_bounties || 0}</strong>
          </div>
        </div>
      </section>
    </>
  );
}
