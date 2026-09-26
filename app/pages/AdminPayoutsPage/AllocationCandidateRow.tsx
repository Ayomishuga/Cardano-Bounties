"use client";

import { LOVELACE_PER_ADA } from "@/lib/bountyContract";
import { getAvailablePrizeSlots } from "@/lib/bountyHelpers";
import { StatusPill } from "@/components/shared/StatusPill";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import styles from "../AdminQueue.module.css";
import type { AllocationDraft, Bounty, BountySubmission } from "./types";
import { getSubmissionHandle } from "./types";

interface AllocationCandidateRowProps {
  bounty: Bounty;
  submission: BountySubmission;
  defaults: { amountLovelace: number; rank: number | null };
  draft: AllocationDraft;
  draftKey: string;
  setAllocationDrafts: React.Dispatch<React.SetStateAction<Record<string, AllocationDraft>>>;
  isAllocating: boolean;
  createAllocation: (
    bounty: Bounty,
    submission: BountySubmission,
    defaults: { amountLovelace: number; rank: number | null },
  ) => Promise<void>;
}

export function AllocationCandidateRow({
  bounty,
  submission,
  defaults,
  draft,
  draftKey,
  setAllocationDrafts,
  isAllocating,
  createAllocation,
}: AllocationCandidateRowProps) {
  const amountValue = draft.amountAda ?? String(defaults.amountLovelace / LOVELACE_PER_ADA);
  const rankValue = draft.rank ?? (defaults.rank ? String(defaults.rank) : "");

  const availableSlots = getAvailablePrizeSlots(
    bounty as any,
    bounty.allocations as any,
  );
  const isMultiWinner = bounty.payout_type === "manual_split" || bounty.payout_type === "equal_split";

  return (
    <tr style={{ background: "rgba(15,118,110,0.035)" }}>
      <td style={{ paddingLeft: 40 }}>
        <div className={styles.submitter}>
          <InitialsAvatar name={submission.contributor_id || "?"} />
          <div>
            <span className={styles.handle}>{getSubmissionHandle(submission)}</span>
            <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
              Approved submission
            </span>
          </div>
        </div>
      </td>
      <td>
        {isMultiWinner && availableSlots.length > 0 ? (
          <select
            value={rankValue}
            aria-label="Select placement slot"
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const chosenRank = Number(event.target.value);
              const chosenSlot = availableSlots.find((s) => s.rank === chosenRank);
              setAllocationDrafts((current) => ({
                ...current,
                [draftKey]: {
                  ...current[draftKey],
                  rank: event.target.value,
                  amountAda: chosenSlot ? String(chosenSlot.amount_ada) : current[draftKey]?.amountAda,
                },
              }));
            }}
            style={{
              padding: "6px 8px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              background: "var(--bg-surface)",
              color: "var(--ink)",
              maxWidth: 160,
            }}
          >
            <option value="">Select rank...</option>
            {availableSlots.map((slot) => (
              <option key={slot.rank} value={slot.rank} disabled={!slot.isAvailable}>
                {slot.label} ({slot.amount_ada} ADA){!slot.isAvailable ? " [Assigned]" : ""}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            min="1"
            step="1"
            value={rankValue}
            placeholder="Rank"
            aria-label="Allocation rank"
            disabled={bounty.payout_type === "single"}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const value = event.target.value;
              setAllocationDrafts((current) => ({
                ...current,
                [draftKey]: { ...current[draftKey], rank: value },
              }));
            }}
            style={{ width: 76, padding: "7px 8px", border: "1px solid var(--border)", borderRadius: 8 }}
          />
        )}
      </td>
      <td>
        <input
          type="number"
          min="0"
          step="0.000001"
          value={amountValue}
          aria-label="Allocation amount in ADA"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const value = event.target.value;
            setAllocationDrafts((current) => ({
              ...current,
              [draftKey]: { ...current[draftKey], amountAda: value },
            }));
          }}
          style={{ width: 110, padding: "7px 8px", border: "1px solid var(--border)", borderRadius: 8 }}
        />
        <span style={{ marginLeft: 6, fontSize: 12, color: "var(--muted)" }}>ADA</span>
      </td>
      <td style={{ textAlign: "right" }}>
        <StatusPill status="pending" label="Ready" />
      </td>
      <td style={{ textAlign: "right" }}>
        <button
          type="button"
          className={styles.approveBtn}
          disabled={isAllocating}
          style={{ padding: "4px 12px", fontSize: 11, minHeight: "auto" }}
          onClick={(event) => {
            event.stopPropagation();
            void createAllocation(bounty, submission, defaults);
          }}
        >
          {isAllocating ? "Adding..." : "Add allocation"}
        </button>
      </td>
    </tr>
  );
}
