"use client";

import { LOVELACE_PER_ADA } from "@/lib/bountyContract";
import { shortId } from "@/lib/formatters";
import { StatusPill } from "@/components/shared/StatusPill";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import styles from "../AdminQueue.module.css";
import type { Allocation, AllocationDraft, Bounty } from "./types";
import { formatAda, getHandle, rankLabel } from "./types";

interface AllocationRowProps {
  alloc: Allocation;
  bounty: Bounty;
  isEditing: boolean;
  editDraft: AllocationDraft;
  setEditDraft: React.Dispatch<React.SetStateAction<AllocationDraft>>;
  setEditingAllocationId: (id: string | null) => void;
  saveEditAllocation: (alloc: Allocation, bounty: Bounty) => Promise<void>;
  cancellingAllocationId: string | null;
  cancelAllocation: (alloc: Allocation, bounty: Bounty) => Promise<void>;
  openReleaseModal: (alloc: Allocation, bounty: Bounty) => void;
}

export function AllocationRow({
  alloc,
  bounty,
  isEditing,
  editDraft,
  setEditDraft,
  setEditingAllocationId,
  saveEditAllocation,
  cancellingAllocationId,
  cancelAllocation,
  openReleaseModal,
}: AllocationRowProps) {
  const handle = getHandle(alloc);
  const isPaid = alloc.status === "paid";
  const isPending = alloc.status === "pending";
  const canEditAlloc = bounty.status === "in_review" && !bounty.winners_finalized && isPending;
  const isCancelling = cancellingAllocationId === alloc.id;

  if (isEditing) {
    return (
      <tr className={styles.childRow} style={{ background: "rgba(234,179,8,0.06)" }}>
        <td style={{ paddingLeft: 40 }}>
          <div className={styles.submitter}>
            <InitialsAvatar name={handle} />
            <span className={styles.handle}>{rankLabel(alloc.rank)}{handle}</span>
          </div>
        </td>
        <td>
          <input
            type="number"
            min="1"
            step="1"
            value={editDraft.rank ?? (alloc.rank ? String(alloc.rank) : "")}
            placeholder="Rank"
            aria-label="Rank"
            disabled={bounty.payout_type === "single"}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setEditDraft((d) => ({ ...d, rank: e.target.value }))}
            style={{ width: 76, padding: "7px 8px", border: "1px solid var(--border)", borderRadius: 8 }}
          />
        </td>
        <td>
          <input
            type="number"
            min="0"
            step="0.000001"
            value={editDraft.amountAda ?? String(Number(alloc.amount_lovelace) / LOVELACE_PER_ADA)}
            aria-label="Amount in ADA"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setEditDraft((d) => ({ ...d, amountAda: e.target.value }))}
            style={{ width: 120, padding: "7px 8px", border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <span style={{ marginLeft: 6, fontSize: 12, color: "var(--muted)" }}>ADA</span>
        </td>
        <td style={{ textAlign: "right" }}>
          <StatusPill status="pending" label="Editing" />
        </td>
        <td style={{ textAlign: "right" }}>
          <button
            type="button"
            className={styles.approveBtn}
            style={{ padding: "4px 12px", fontSize: 11, minHeight: "auto", marginRight: 4 }}
            onClick={(e) => { e.stopPropagation(); void saveEditAllocation(alloc, bounty); }}
          >
            Save
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.danger}`}
            title="Discard edit"
            onClick={(e) => { e.stopPropagation(); setEditingAllocationId(null); setEditDraft({}); }}
            aria-label="Discard edit"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={styles.childRow}
      style={{
        background: "rgba(1,81,194,0.025)",
        cursor: isPending && bounty.winners_finalized ? "pointer" : "default",
      }}
      onClick={() => {
        if (isPending && bounty.winners_finalized) openReleaseModal(alloc, bounty);
      }}
    >
      <td style={{ paddingLeft: 40 }}>
        <div className={styles.submitter}>
          <InitialsAvatar name={handle} />
          <div>
            <span className={styles.handle} title={handle}>{rankLabel(alloc.rank)}{handle}</span>
            {alloc.transaction_hash && (
              <span style={{ display: "block", fontFamily: "monospace", fontSize: 10, color: "var(--muted)" }}>
                {shortId(alloc.transaction_hash)}
              </span>
            )}
          </div>
        </div>
      </td>
      <td><div className={styles.amount}>{formatAda(alloc.amount_lovelace)}</div></td>
      <td>
        <StatusPill status={alloc.status} />
      </td>
      <td style={{ textAlign: "right" }}>
        {isPaid ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Paid">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : isPending && bounty.winners_finalized ? (
          <button
            type="button"
            className={styles.approveBtn}
            style={{ padding: "4px 12px", fontSize: 11, minHeight: "auto" }}
            onClick={(e) => { e.stopPropagation(); openReleaseModal(alloc, bounty); }}
            aria-label="Release payment"
          >
            Release
          </button>
        ) : null}
      </td>
      <td style={{ textAlign: "right" }}>
        {canEditAlloc && (
          <>
            <button
              type="button"
              className={styles.iconBtn}
              title="Edit allocation"
              onClick={(e) => {
                e.stopPropagation();
                setEditingAllocationId(alloc.id);
                setEditDraft({
                  amountAda: String(Number(alloc.amount_lovelace) / LOVELACE_PER_ADA),
                  rank: alloc.rank ? String(alloc.rank) : "",
                });
              }}
              aria-label="Edit allocation"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.danger}`}
              title="Cancel allocation"
              disabled={isCancelling}
              onClick={(e) => { e.stopPropagation(); void cancelAllocation(alloc, bounty); }}
              aria-label="Cancel allocation"
            >
              {isCancelling ? (
                <div className={styles.spinner} style={{ width: 12, height: 12 }} />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </button>
          </>
        )}
      </td>
    </tr>
  );
}
