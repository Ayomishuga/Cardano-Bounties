"use client";

import { Fragment } from "react";
import { LOVELACE_PER_ADA } from "@/lib/bountyContract";
import { StatusPill } from "@/components/shared/StatusPill";
import styles from "../AdminQueue.module.css";
import type { Allocation, AllocationDraft, Bounty, BountySubmission } from "./types";
import { formatAda, formatAdaValue, rewardToLovelace } from "./types";
import { AllocationRow } from "./AllocationRow";
import { AllocationCandidateRow } from "./AllocationCandidateRow";

interface BountyPayoutRowProps {
  bounty: Bounty;
  isExpanded: boolean;
  toggleExpand: (bounty: Bounty) => Promise<void>;
  reviewingBountyId: string | null;
  startReview: (bounty: Bounty) => Promise<void>;
  editingAllocationId: string | null;
  setEditingAllocationId: (id: string | null) => void;
  editDraft: AllocationDraft;
  setEditDraft: React.Dispatch<React.SetStateAction<AllocationDraft>>;
  saveEditAllocation: (alloc: Allocation, bounty: Bounty) => Promise<void>;
  cancellingAllocationId: string | null;
  cancelAllocation: (alloc: Allocation, bounty: Bounty) => Promise<void>;
  openReleaseModal: (alloc: Allocation, bounty: Bounty) => void;
  getAllocationDefaults: (bounty: Bounty, index: number) => { amountLovelace: number; rank: number | null };
  getDraftKey: (bountyId: string, submissionId: string) => string;
  allocationDrafts: Record<string, AllocationDraft>;
  setAllocationDrafts: React.Dispatch<React.SetStateAction<Record<string, AllocationDraft>>>;
  allocatingSubmissionId: string | null;
  createAllocation: (
    bounty: Bounty,
    submission: BountySubmission,
    defaults: { amountLovelace: number; rank: number | null },
  ) => Promise<void>;
  finalizingBountyId: string | null;
  finalizeWinners: (bounty: Bounty) => Promise<void>;
}

export function BountyPayoutRow({
  bounty,
  isExpanded,
  toggleExpand,
  reviewingBountyId,
  startReview,
  editingAllocationId,
  setEditingAllocationId,
  editDraft,
  setEditDraft,
  saveEditAllocation,
  cancellingAllocationId,
  cancelAllocation,
  openReleaseModal,
  getAllocationDefaults,
  getDraftKey,
  allocationDrafts,
  setAllocationDrafts,
  allocatingSubmissionId,
  createAllocation,
  finalizingBountyId,
  finalizeWinners,
}: BountyPayoutRowProps) {
  const allocs = bounty.allocations ?? [];
  const activeAllocations = allocs.filter((a) => a.status !== "cancelled");
  const allocatedSubmissionIds = new Set(activeAllocations.map((a) => a.submission_id));
  const approvedSubmissions = (bounty.submissions ?? []).filter(
    (submission) => submission.status === "approved" && !allocatedSubmissionIds.has(submission.id),
  );
  const allocatedTotal = activeAllocations.reduce((sum, allocation) => sum + Number(allocation.amount_lovelace || 0), 0);
  const rewardLovelace = rewardToLovelace(bounty.reward_amount);
  const canFinalize = bounty.status === "in_review" && activeAllocations.length > 0 && allocatedTotal === rewardLovelace;
  const paidCount = allocs.filter((a) => a.status === "paid").length;

  return (
    <Fragment>
      {/* Bounty parent row */}
      <tr
        onClick={() => void toggleExpand(bounty)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            void toggleExpand(bounty);
          }
        }}
        aria-expanded={isExpanded}
        style={{ cursor: "pointer", fontWeight: 600 }}
      >
        <td>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={styles.expandChevron} data-open={String(isExpanded)} aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
            <span className={styles.bountyTitle} title={bounty.title}>{bounty.title}</span>
          </div>
        </td>
        <td>
          <StatusPill
            status="open"
            label={bounty.payout_type?.replace(/_/g, " ") ?? "single"}
            style={{ textTransform: "capitalize" }}
          />
        </td>
        <td>
          <div className={styles.amount}>
            {formatAda((Number(bounty.reward_amount ?? 0) * LOVELACE_PER_ADA).toString())}
          </div>
        </td>
        <td style={{ textAlign: "right" }}>
          <StatusPill status={bounty.status} />
          {bounty.allocations && (
            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
              {paidCount}/{allocs.filter((a) => a.status !== "cancelled").length} paid
            </span>
          )}
        </td>
        <td style={{ textAlign: "right" }}>
          <button
            type="button"
            aria-label={isExpanded ? "Collapse allocations" : "Expand allocations"}
            tabIndex={-1}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points={isExpanded ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
            </svg>
          </button>
          {bounty.status === "open" ? (
            <button
              type="button"
              className={styles.approveBtn}
              disabled={reviewingBountyId === bounty.id}
              style={{ marginLeft: 8, padding: "4px 12px", fontSize: 11, minHeight: "auto" }}
              onClick={(event) => {
                event.stopPropagation();
                void startReview(bounty);
              }}
            >
              {reviewingBountyId === bounty.id ? "Starting..." : "Start review"}
            </button>
          ) : null}
        </td>
      </tr>

      {isExpanded && (
        <>
          {allocs.map((alloc) => (
            <AllocationRow
              key={alloc.id}
              alloc={alloc}
              bounty={bounty}
              isEditing={editingAllocationId === alloc.id}
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              setEditingAllocationId={setEditingAllocationId}
              saveEditAllocation={saveEditAllocation}
              cancellingAllocationId={cancellingAllocationId}
              cancelAllocation={cancelAllocation}
              openReleaseModal={openReleaseModal}
            />
          ))}

          {bounty.winners_finalized && allocs.filter((a) => a.status !== "cancelled").length > 0 && (() => {
            const paidLv = allocs.filter((a) => a.status === "paid").reduce((s, a) => s + Number(a.amount_lovelace), 0);
            const remainLv = rewardLovelace - paidLv;
            return (
              <tr key={`${bounty.id}-pay-summary`}>
                <td colSpan={5} style={{ paddingLeft: 40, paddingTop: 6, paddingBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    Pool: <strong>{formatAdaValue(rewardLovelace)} ADA</strong>
                    {" · "}Paid: <strong style={{ color: "#16a34a" }}>{formatAdaValue(paidLv)} ADA</strong>
                    {" · "}Remaining: <strong style={{ color: remainLv > 0 ? "var(--blue)" : "var(--muted)" }}>{formatAdaValue(remainLv)} ADA</strong>
                  </span>
                </td>
              </tr>
            );
          })()}

          {bounty.status === "open" && approvedSubmissions.length > 0 ? (
            <tr key={`${bounty.id}-start-review-help`}>
              <td colSpan={5} style={{ paddingLeft: 40, color: "var(--muted)", fontSize: 12 }}>
                {approvedSubmissions.length} approved submission{approvedSubmissions.length === 1 ? "" : "s"} ready. Start review to close public submissions and create payout allocations.
              </td>
            </tr>
          ) : null}

          {bounty.status === "in_review" &&
            approvedSubmissions.map((submission, index) => {
              const defaults = getAllocationDefaults(bounty, index);
              const draftKey = getDraftKey(bounty.id, submission.id);
              const draft = allocationDrafts[draftKey] ?? {};

              return (
                <AllocationCandidateRow
                  key={`${bounty.id}-${submission.id}-candidate`}
                  bounty={bounty}
                  submission={submission}
                  defaults={defaults}
                  draft={draft}
                  draftKey={draftKey}
                  setAllocationDrafts={setAllocationDrafts}
                  isAllocating={allocatingSubmissionId === submission.id}
                  createAllocation={createAllocation}
                />
              );
            })}

          {isExpanded && allocs.length === 0 && approvedSubmissions.length === 0 ? (
            <tr key={`${bounty.id}-no-alloc`}>
              <td colSpan={5} style={{ paddingLeft: 40, color: "var(--muted)", fontSize: 12, fontStyle: "italic" }}>
                No payout allocations yet. Approve submissions first, then start review to allocate the reward pool.
              </td>
            </tr>
          ) : null}

          {bounty.status === "in_review" ? (
            <tr key={`${bounty.id}-allocation-summary`}>
              <td colSpan={2} style={{ paddingLeft: 40, fontSize: 12, color: "var(--muted)" }}>
                Allocated {formatAdaValue(allocatedTotal)} / {formatAdaValue(rewardLovelace)} ADA
              </td>
              <td>
                <div style={{ height: 6, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, rewardLovelace ? (allocatedTotal / rewardLovelace) * 100 : 0)}%`,
                      background: allocatedTotal === rewardLovelace ? "var(--success, #16a34a)" : "var(--blue)",
                    }}
                  />
                </div>
              </td>
              <td style={{ textAlign: "right" }}>
                <StatusPill
                  status={canFinalize ? "approved" : "pending"}
                  label={canFinalize ? "Ready to finalize" : "Allocation incomplete"}
                />
              </td>
              <td style={{ textAlign: "right" }}>
                <button
                  type="button"
                  className={styles.approveBtn}
                  disabled={!canFinalize || finalizingBountyId === bounty.id}
                  style={{ padding: "4px 12px", fontSize: 11, minHeight: "auto" }}
                  onClick={(event) => {
                    event.stopPropagation();
                    void finalizeWinners(bounty);
                  }}
                >
                  {finalizingBountyId === bounty.id ? "Finalizing..." : "Finalize winners"}
                </button>
              </td>
            </tr>
          ) : null}
        </>
      )}
    </Fragment>
  );
}
