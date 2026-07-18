"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/api";
import styles from "./AdminQueue.module.css";
import Link from "next/link";

type Bounty = {
  id: string;
  status: string;
  reward_amount?: number | string | null;
  submissions?: Submission[];
};

type Submission = {
  id: string;
  status: string;
  bounties?: Bounty | Bounty[] | null;
  bounty?: Bounty;
};

type DashboardResponse = {
  metrics: Record<string, number>;
  queues: {
    bounties?: Bounty[];
    pending_submissions?: Submission[];
    approved_payouts?: Submission[];
    refund_candidates?: Bounty[];
  };
  error?: string;
};

type TreasuryMetric = {
  id: string;
  metric: string;
  value: string;
  status: string;
  notes: string;
  linkTo?: string;
  linkText?: string;
};

function formatAda(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(amount)} ADA`;
}

function getSubmissionBounty(submission: Submission) {
  if (submission.bounty) return submission.bounty;
  if (Array.isArray(submission.bounties)) return submission.bounties[0];
  return submission.bounties || null;
}

export function AdminTreasuryPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/dashboard/admin", { headers: { Accept: "application/json" } });
      const payload = (await response.json()) as DashboardResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load treasury.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load treasury.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const items = useMemo(() => {
    const bounties = data?.queues.bounties || [];
    const approvedPayouts = data?.queues.approved_payouts || [];
    const refundCandidates = data?.queues.refund_candidates || [];

    const openBountyValue = bounties
      .filter((bounty) => bounty.status === "open")
      .reduce((sum, bounty) => sum + Number(bounty.reward_amount || 0), 0);
      
    const queuedPayoutValue = approvedPayouts.reduce(
      (sum, submission) => sum + Number(getSubmissionBounty(submission)?.reward_amount || 0),
      0,
    );
    
    const refundExposure = refundCandidates.reduce(
      (sum, bounty) => sum + Number(bounty.reward_amount || 0),
      0,
    );

    const list: TreasuryMetric[] = [
      {
        id: "open",
        metric: "Open bounty rewards",
        value: formatAda(openBountyValue),
        status: "Committed",
        notes: "Total reward value across open public bounties.",
        linkTo: "/dashboard/bounties",
        linkText: "View Bounties"
      },
      {
        id: "payouts",
        metric: "Queued payouts",
        value: formatAda(queuedPayoutValue),
        status: "Needs payment",
        notes: "Approved submissions waiting for payout transaction recording.",
        linkTo: "/dashboard/payouts",
        linkText: "Process Payouts"
      },
      {
        id: "refunds",
        metric: "Refund exposure",
        value: formatAda(refundExposure),
        status: "Needs review",
        notes: "Rejected, cancelled, or expired funded bounties that may require refund handling.",
        linkTo: "/dashboard/refunds",
        linkText: "Review Refunds"
      },
      {
        id: "approvals",
        metric: "Bounties awaiting admin review",
        value: String(data?.metrics.awaiting_bounty_reviews || 0),
        status: "Operational",
        notes: "Funded bounties not yet public.",
        linkTo: "/dashboard/approvals",
        linkText: "Review Approvals"
      },
    ];

    return list;
  }, [data]);

  const selectedItem = useMemo(() => items.find((m) => m.id === selectedMetricId) || null, [items, selectedMetricId]);

  const handleRowClick = (id: string) => {
    setSelectedMetricId(id);
  };

  const handleCloseModal = () => {
    setSelectedMetricId(null);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedMetricId) {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedMetricId]);

  return (
    <div className={styles.container}>
      <div className={styles.tableWrap}>
        <table className={styles.table} role="grid" aria-label="Treasury">
          <thead>
            <tr>
              <th><div className={styles.thContent}>Metric</div></th>
              <th><div className={styles.thContent}>Value</div></th>
              <th><div className={styles.thContent}>Status</div></th>
              <th><div className={styles.thContent}>Notes</div></th>
              <th><div className={`${styles.thContent} ${styles.right}`}>Actions</div></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} aria-hidden="true">
                  <td><div className={styles.shimmer} style={{ width: '180px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '100px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '80px', borderRadius: '999px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '250px' }} /></td>
                  <td><div className={styles.shimmer} style={{ width: '24px', marginLeft: 'auto' }} /></td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={5}>
                  <div className={styles.emptyState}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <h3>Couldn't load treasury metrics</h3>
                    <p>{error}</p>
                    <button type="button" className={styles.clearFilterBtn} onClick={() => void loadDashboard()}>Retry</button>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((metric) => (
                <tr key={metric.id} onClick={() => handleRowClick(metric.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(metric.id); } }}>
                  <td>
                    <span style={{ fontWeight: 500 }}>{metric.metric}</span>
                  </td>
                  <td>
                    <div className={styles.amount} style={{ fontSize: '16px' }}>{metric.value}</div>
                  </td>
                  <td>
                    <span className={styles.statusPill} data-status={metric.status === "Committed" ? "approved" : metric.status === "Needs payment" ? "warning" : metric.status === "Needs review" ? "danger" : "pending"}>
                      {metric.status}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--muted)', fontSize: '14px' }}>{metric.notes}</span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button type="button" aria-label="View metric" tabIndex={-1} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedItem && (
        <div className={styles.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderLeft}>
                <span className={styles.statusPill} data-status={selectedItem.status === "Committed" ? "approved" : selectedItem.status === "Needs payment" ? "warning" : selectedItem.status === "Needs review" ? "danger" : "pending"}>
                  {selectedItem.status}
                </span>
                <span className={styles.modalAmount}>{selectedItem.value}</span>
              </div>
              <button type="button" className={styles.closeBtn} onClick={handleCloseModal} aria-label="Close modal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <h3 id="modal-title" className={styles.modalTitle}>{selectedItem.metric}</h3>
              
              <div className={styles.contentSection} style={{ marginTop: '24px' }}>
                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel}>Calculation Logic</div>
                  <div className={styles.contentValue} style={{ lineHeight: 1.5 }}>
                    {selectedItem.notes}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter} style={{ justifyContent: 'flex-end' }}>
              {selectedItem.linkTo && (
                <Link href={selectedItem.linkTo} className={styles.approveBtn} style={{ textDecoration: 'none' }} onClick={handleCloseModal}>
                  {selectedItem.linkText}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
