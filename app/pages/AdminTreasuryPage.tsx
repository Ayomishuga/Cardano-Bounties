"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/api";
import styles from "./AdminQueue.module.css";
import Link from "next/link";
import type { Bounty, Submission } from "@/types/bounty";
import { formatAda } from "@/lib/formatters";
import { getSubmissionBounty } from "@/lib/bountyHelpers";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { StatusPill } from "@/components/shared/StatusPill";
import { ModalCloseButton } from "@/components/shared/ModalCloseButton";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { TableActionChevron } from "@/components/shared/TableActionChevron";

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

  useEscapeKey(handleCloseModal, Boolean(selectedMetricId));

  const columns = useMemo<ColumnDef<TreasuryMetric>[]>(() => [
    {
      id: "metric",
      header: "Metric",
      cell: (metric) => <span style={{ fontWeight: 500 }}>{metric.metric}</span>,
    },
    {
      id: "value",
      header: "Value",
      cell: (metric) => <div className={styles.amount} style={{ fontSize: '16px' }}>{metric.value}</div>,
    },
    {
      id: "status",
      header: "Status",
      cell: (metric) => <StatusPill status={metric.status} label={metric.status} />,
    },
    {
      id: "notes",
      header: "Notes",
      cell: (metric) => <span style={{ color: 'var(--muted)', fontSize: '14px' }}>{metric.notes}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      cell: () => (
        <TableActionChevron
          ariaLabel="View metric"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="3" r="3" />
            </svg>
          }
        />
      ),
    },
  ], []);

  return (
    <div className={styles.container}>
      <DataTable
        data={items}
        columns={columns}
        ariaLabel="Treasury"
        isLoading={isLoading}
        error={error}
        errorTitle="Couldn't load treasury metrics"
        onRetry={() => void loadDashboard()}
        onRowClick={(metric) => handleRowClick(metric.id)}
      />

      {selectedItem && (
        <div className={styles.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderLeft}>
                <StatusPill status={selectedItem.status} label={selectedItem.status} />
                <span className={styles.modalAmount}>{selectedItem.value}</span>
              </div>
              <ModalCloseButton onClose={handleCloseModal} size={20} />
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
