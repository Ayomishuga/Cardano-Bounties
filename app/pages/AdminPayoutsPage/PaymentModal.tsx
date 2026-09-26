"use client";

import { Shimmer } from "@/components/dashboard/ShimmerLoaders";
import { shortId } from "@/lib/formatters";
import { CopyIconButton } from "@/components/shared/CopyIconButton";
import { StatusPill } from "@/components/shared/StatusPill";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { ModalCloseButton } from "@/components/shared/ModalCloseButton";
import styles from "../AdminQueue.module.css";
import type { Allocation, Bounty } from "./types";
import { formatAda, getHandle, rankLabel } from "./types";

interface PaymentModalProps {
  selectedAlloc: Allocation;
  selectedBounty: Bounty;
  txHash: string;
  setTxHash: (val: string) => void;
  resolvingAddress: boolean;
  resolvedAddress: string | null;
  resolvedSource: string | null;
  resolveError: string | null;
  isSubmitting: boolean;
  isExecutingOnChain: boolean;
  closeModal: () => void;
  recordManualPayout: () => void;
  executeOnChainPayout: () => void;
}

export function PaymentModal({
  selectedAlloc,
  selectedBounty,
  txHash,
  setTxHash,
  resolvingAddress,
  resolvedAddress,
  resolvedSource,
  resolveError,
  isSubmitting,
  isExecutingOnChain,
  closeModal,
  recordManualPayout,
  executeOnChainPayout,
}: PaymentModalProps) {
  const handle = getHandle(selectedAlloc);

  return (
    <div
      className={styles.modalBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <StatusPill status={selectedAlloc.status} />
            <span className={styles.modalAmount}>{formatAda(selectedAlloc.amount_lovelace)}</span>
          </div>
          <ModalCloseButton onClose={closeModal} size={20} />
        </div>

        <div className={styles.modalBody}>
          <h3 id="modal-title" className={styles.modalTitle}>
            {rankLabel(selectedAlloc.rank)}{selectedBounty.title}
          </h3>

          <div className={styles.submitterInfo}>
            <InitialsAvatar name={handle} />
            <span className={styles.handle} style={{ fontSize: 14 }}>{handle}</span>
            <div className={styles.hashGroup}>
              <span>Alloc: {shortId(selectedAlloc.id)}</span>
              <CopyIconButton
                text={selectedAlloc.id}
                label="Copy allocation ID"
                className={styles.copyBtn}
              />
            </div>
          </div>

          <div className={styles.contentSection}>
            <div className={styles.contentBlock}>
              <div className={styles.contentLabel}>Recipient stake address</div>
              <div className={styles.contentValue} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, wordBreak: "break-all" }}>
                {resolvingAddress ? (
                  <Shimmer style={{ height: "16px", width: "100%", borderRadius: "4px" }} />
                ) : resolvedAddress ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ color: "var(--foreground)" }}>{resolvedAddress}</span>
                    {resolvedSource && (
                      <span style={{ fontSize: "10px", color: "var(--muted)", alignSelf: "flex-start", padding: "2px 6px", borderRadius: "4px", backgroundColor: "var(--border)" }}>
                        Resolved via {resolvedSource}
                      </span>
                    )}
                  </div>
                ) : resolveError ? (
                  <span style={{ color: "#dc2626", fontSize: 11, fontWeight: 500 }}>
                    ⚠️ {resolveError}
                  </span>
                ) : (
                  <span style={{ color: "var(--muted)", fontStyle: "italic" }}>No payment address resolved</span>
                )}
              </div>
            </div>
            <div className={styles.contentBlock}>
              <div className={styles.contentLabel}>Payout amount</div>
              <div className={styles.contentValue} style={{ fontWeight: 700, fontSize: 15, color: "var(--blue)" }}>
                {formatAda(selectedAlloc.amount_lovelace)}
                <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: "var(--muted)" }}>
                  ({Number(selectedAlloc.amount_lovelace).toLocaleString()} lovelace)
                </span>
              </div>
            </div>
          </div>

          <div className={styles.adminNoteSection}>
            <label className={styles.contentLabel} htmlFor="tx-hash-modal">Payout transaction hash</label>
            <input
              id="tx-hash-modal"
              type="text"
              className={styles.adminNoteTextarea}
              style={{ minHeight: "auto", padding: "10px 12px" }}
              placeholder="64-character Cardano transaction hash"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.rejectBtn} disabled={isSubmitting || isExecutingOnChain} onClick={() => void recordManualPayout()}>
            {isSubmitting ? <div className={styles.spinner} /> : "Record Manual Payout"}
          </button>
          <button type="button" className={styles.approveBtn} disabled={isSubmitting || isExecutingOnChain} onClick={() => void executeOnChainPayout()}>
            {isExecutingOnChain ? <div className={styles.spinner} /> : "Release On-Chain"}
          </button>
        </div>
      </div>
    </div>
  );
}
