"use client";

import React, { useState, useMemo, useEffect } from "react";
import type { Bounty, Submission } from "@/types/bounty";
import {
  formatAda,
  formatLovelaceAsAda,
  normalizeStatus,
  formatDate,
  formatDateTime,
  shortId,
} from "@/lib/formatters";
import {
  getPayoutTypeLabel,
  getAvailablePrizeSlots,
  getRankMedal,
  getRankPlacementLabel,
} from "@/lib/bountyHelpers";
import { ContentWithLinks } from "@/components/shared/ContentWithLinks";
import { CopyIconButton } from "@/components/shared/CopyIconButton";
import { StatusPill } from "@/components/shared/StatusPill";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { ModalCloseButton } from "@/components/shared/ModalCloseButton";
import { ModalNavControls } from "@/components/shared/ModalNavControls";
import { getSubmitterHandle, getPayoutSummary, getBountyCategoryLabel } from "./types";
import styles from "../AdminQueue.module.css";

export function SubmissionDetailModal({
  selectedItem,
  selectedBounty,
  allocations = [],
  isLoadingAllocations = false,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onClose,
  contextOpen,
  setContextOpen,
  adminNote,
  setAdminNote,
  isSubmitting,
  onRunAction,
}: {
  selectedItem: Submission;
  selectedBounty: Bounty | null;
  allocations?: any[];
  isLoadingAllocations?: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  contextOpen: boolean;
  setContextOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  adminNote: string;
  setAdminNote: (note: string) => void;
  isSubmitting: boolean;
  onRunAction: (status: "approved" | "rejected", rank?: number | null, amountLovelace?: number | null) => Promise<void>;
}) {
  const handle = getSubmitterHandle(selectedItem);

  const availableSlots = useMemo(() => {
    return getAvailablePrizeSlots(selectedBounty, allocations);
  }, [selectedBounty, allocations]);

  const [selectedRank, setSelectedRank] = useState<number | null>(null);

  useEffect(() => {
    if (selectedBounty?.payout_type === "single" || !selectedBounty?.payout_type) {
      setSelectedRank(1);
      return;
    }
    const firstAvailable = availableSlots.find((s) => s.isAvailable);
    if (firstAvailable) {
      setSelectedRank(firstAvailable.rank);
    } else if (availableSlots.length > 0) {
      setSelectedRank(availableSlots[0].rank);
    }
  }, [selectedBounty, availableSlots]);

  const activeSlot = availableSlots.find((s) => s.rank === selectedRank);
  const thisSubmissionAlloc = allocations.find(
    (a) => a.submission_id === selectedItem.id && a.status !== "cancelled"
  );

  return (
    <div
      className={styles.modalBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <StatusPill status={selectedItem.status} />
            <span className={styles.modalAmount}>{formatAda(selectedBounty?.reward_amount)}</span>
            <span className={styles.modalMetaPill}>{getPayoutTypeLabel(selectedBounty?.payout_type)}</span>
            {(() => {
              const b = selectedBounty;
              const total = b?.submission_count ?? 0;
              if (!total) return null;
              return (
                <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {total} submission{total !== 1 ? "s" : ""}
                  {" · "}
                  <span style={{ color: "var(--status-success-text)" }}>{b?.approved_count ?? 0} approved</span>
                </span>
              );
            })()}
          </div>
          <ModalCloseButton onClose={onClose} size={20} />
        </div>

        <div className={styles.modalBody}>
          <h3 id="modal-title" className={styles.modalTitle}>{selectedBounty?.title || "Unknown Bounty"}</h3>

          <div className={styles.submitterInfo}>
            <InitialsAvatar name={handle} />
            <span className={styles.handle} style={{ fontSize: "14px" }}>{handle}</span>

            <div className={styles.hashGroup}>
              <span>ID: {shortId(selectedItem.id)}</span>
              <CopyIconButton
                text={selectedItem.id}
                label="Copy submission ID"
                className={styles.copyBtn}
              />
            </div>
          </div>

          <section className={styles.contextPanel} aria-label="Bounty context for submission review">
            <button
              type="button"
              className={styles.contextHeader}
              onClick={() => setContextOpen((open) => !open)}
              aria-expanded={contextOpen}
            >
              <span>Bounty context and review criteria</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.contextChevron}
                data-open={contextOpen}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {contextOpen && (
              <div className={styles.contextBody}>
                <div className={styles.contextMetaGrid}>
                  <div>
                    <span>Category</span>
                    <strong>{getBountyCategoryLabel(selectedBounty)}</strong>
                  </div>
                  <div>
                    <span>Bounty status</span>
                    <strong>{normalizeStatus(selectedBounty?.status || "Unknown")}</strong>
                  </div>
                  <div>
                    <span>Deadline</span>
                    <strong>{formatDate(selectedBounty?.deadline)}</strong>
                  </div>
                  <div>
                    <span>Payout rule</span>
                    <strong>{getPayoutTypeLabel(selectedBounty?.payout_type)}</strong>
                  </div>
                </div>

                <div className={styles.contextBlock}>
                  <div className={styles.contentLabel}>Bounty brief</div>
                  <div className={`${styles.contentValue} ${!selectedBounty?.description ? styles.missingValue : ""}`}>
                    {selectedBounty?.description || "No bounty description was provided."}
                  </div>
                </div>

                <div className={styles.contextBlock} data-emphasis="true">
                  <div className={styles.contentLabel}>Acceptance criteria / instructions</div>
                  <div className={`${styles.contentValue} ${!selectedBounty?.bounty_instructions ? styles.missingValue : ""}`}>
                    {selectedBounty?.bounty_instructions || "No acceptance criteria were provided. Use the submission evidence and poster recommendation with extra caution."}
                  </div>
                </div>

                <div className={styles.payoutReviewBox}>
                  <div>
                    <span>Reward pool</span>
                    <strong>{formatAda(selectedBounty?.reward_amount)}</strong>
                  </div>
                  <div>
                    <span>Winner capacity</span>
                    <strong>{selectedBounty?.max_winners ?? 1}</strong>
                  </div>
                  <p>{getPayoutSummary(selectedBounty)}</p>
                </div>

                {selectedBounty?.payout_type === "manual_split" && selectedBounty.prize_structure && selectedBounty.prize_structure.length > 0 ? (
                  <div className={styles.prizeList} aria-label="Manual prize structure">
                    {[...selectedBounty.prize_structure].sort((a, b) => a.rank - b.rank).map((prize) => (
                      <span key={prize.rank}>
                        Rank {prize.rank}: {formatLovelaceAsAda(prize.amount_lovelace)}
                      </span>
                    ))}
                  </div>
                ) : null}

                {selectedBounty?.id ? (
                  <a className={styles.contextLink} href={`/bounties/${selectedBounty.id}`} target="_blank" rel="noopener noreferrer">
                    Open full bounty details
                  </a>
                ) : null}
              </div>
            )}
          </section>

          <div className={styles.contentSection}>
            <div className={styles.contentBlock} style={{ display: "flex", gap: 0 }}>
              <div style={{ flex: 1 }}>
                <div className={styles.contentLabel}>Submitted</div>
                <div className={styles.contentValue}>{formatDateTime(selectedItem.submitted_at)}</div>
              </div>
              {(() => {
                const b = selectedBounty;
                if (!b) return null;
                return (
                  <div style={{ flex: 1, borderLeft: "1px solid var(--line)", paddingLeft: 16 }}>
                    <div className={styles.contentLabel}>Competing submissions</div>
                    <div className={styles.contentValue}>
                      {b.submission_count} total
                      {(b.approved_count ?? 0) > 0 && <span style={{ marginLeft: 8, color: "var(--status-success-text)" }}>· {b.approved_count} approved</span>}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className={styles.contentBlock}>
              <div className={styles.contentLabel}>Contributor note</div>
              <div className={styles.contentValue}>
                <ContentWithLinks content={selectedItem.content} linkClassName={styles.contentLink} />
              </div>
            </div>
            <div className={styles.contentBlock}>
              <div className={styles.posterReviewHeader}>
                <div>
                  <div className={styles.contentLabel}>Poster recommendation</div>
                  <div className={styles.contentValue}>{normalizeStatus(selectedItem.poster_review_status || "Pending")}</div>
                </div>
                <span>{formatDateTime(selectedItem.poster_reviewed_at)}</span>
              </div>
              <div className={`${styles.contentValue} ${!selectedItem.poster_feedback ? styles.missingValue : ""}`}>
                {selectedItem.poster_feedback || "No poster feedback was provided."}
              </div>
            </div>
          </div>

          {selectedItem.status.toLowerCase() === "pending" && (
            <div className={styles.allocationSection}>
              <div className={styles.allocationSectionTitle}>
                <span>Award Position & Prize Allocation</span>
                <span className={styles.modalMetaPill}>{getPayoutTypeLabel(selectedBounty?.payout_type)}</span>
              </div>
              <p className={styles.allocationSectionDesc}>
                Select the placement for this submission. The exact prize in ADA will be locked in for payout.
              </p>

              {selectedBounty?.payout_type === "single" || !selectedBounty?.payout_type ? (
                <div className={styles.positionCard} data-selected="true">
                  <div className={styles.positionCardHeader}>
                    <span className={styles.positionCardRank}>🥇 Winner (1st Place)</span>
                    <span className={styles.positionBadgeAvailable}>Full Pool</span>
                  </div>
                  <div className={styles.positionCardAmount}>{formatAda(selectedBounty?.reward_amount)}</div>
                </div>
              ) : (
                <div className={styles.positionGrid}>
                  {availableSlots.map((slot) => {
                    const isSelected = selectedRank === slot.rank;
                    const isDisabled = !slot.isAvailable && !isSelected;

                    return (
                      <div
                        key={slot.rank}
                        className={styles.positionCard}
                        data-selected={isSelected}
                        data-disabled={isDisabled}
                        onClick={() => {
                          if (slot.isAvailable || isSelected) {
                            setSelectedRank(slot.rank);
                          }
                        }}
                      >
                        <div className={styles.positionCardHeader}>
                          <span className={styles.positionCardRank}>{slot.label}</span>
                          {slot.isAvailable ? (
                            <span className={styles.positionBadgeAvailable}>Available</span>
                          ) : (
                            <span
                              className={styles.positionBadgeAssigned}
                              title={`Assigned to ${slot.assignedContributorName}`}
                            >
                              {slot.assignedContributorName}
                            </span>
                          )}
                        </div>
                        <div className={styles.positionCardAmount}>
                          {slot.amount_ada.toLocaleString(undefined, { maximumFractionDigits: 6 })} ADA
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeSlot && (
                <div className={styles.lockedCallout}>
                  <span>
                    Placement: <strong>{getRankMedal(selectedRank)} {getRankPlacementLabel(selectedRank)}</strong>
                  </span>
                  <span>
                    Locked Payout: <strong>{activeSlot.amount_ada.toLocaleString(undefined, { maximumFractionDigits: 6 })} ADA</strong>
                  </span>
                </div>
              )}
            </div>
          )}

          <div className={styles.adminNoteSection}>
            <label className={styles.contentLabel} htmlFor="admin-note-modal">
              Feedback to contributor
              <span style={{ fontWeight: 400, fontSize: 11, textTransform: "none", marginLeft: 6, color: "var(--muted)" }}>(sent in notification on reject)</span>
            </label>
            <textarea
              id="admin-note-modal"
              className={styles.adminNoteTextarea}
              placeholder="Add an internal note for this review. Will be saved when you approve or reject."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.modalFooter}>
          <ModalNavControls
            itemLabel="submission"
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onPrev={onPrev}
            onNext={onNext}
          />

          {selectedItem.status.toLowerCase() !== "pending" ? (
            thisSubmissionAlloc ? (
              <div
                className={styles.resolutionState}
                style={{ background: "rgba(22, 163, 74, 0.08)", color: "var(--status-success-text)" }}
              >
                {getRankMedal(thisSubmissionAlloc.rank)} {getRankPlacementLabel(thisSubmissionAlloc.rank)} (
                {formatAda(thisSubmissionAlloc.amount_lovelace)}) · Approved for payout
              </div>
            ) : (
              <div className={styles.resolutionState}>
                {normalizeStatus(selectedItem.status)} 
                {selectedItem.status.toLowerCase() === "approved" ? " for payout" : ""}
              </div>
            )
          ) : (
            <>
              <button
                type="button"
                className={styles.rejectBtn}
                disabled={isSubmitting}
                onClick={() => void onRunAction("rejected")}
              >
                {isSubmitting ? <div className={styles.spinner} /> : "Reject"}
              </button>
              <button
                type="button"
                className={styles.approveBtn}
                disabled={isSubmitting}
                onClick={() => void onRunAction("approved", selectedRank, activeSlot?.amount_lovelace)}
              >
                {isSubmitting ? (
                  <div className={styles.spinner} />
                ) : selectedRank && activeSlot ? (
                  `Approve & Award ${getRankPlacementLabel(selectedRank)} (${activeSlot.amount_ada.toLocaleString(undefined, { maximumFractionDigits: 6 })} ADA)`
                ) : (
                  "Approve"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
