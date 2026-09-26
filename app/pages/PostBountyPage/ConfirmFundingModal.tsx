"use client";

import styles from "../PostBountyPage.module.css";
import { adaFormatter } from "./types";

export function ConfirmFundingModal({
  amountBreakdown,
  onClose,
  onConfirm,
}: {
  amountBreakdown: { contributorReward: number; platformFee: number; totalFunding: number; isValid: boolean };
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h3>Confirm Bounty Funding</h3>
        <p>You are about to post a new bounty and initiate an on-chain escrow transaction.</p>

        <div className={styles.modalBreakdown}>
          <div className={styles.modalBreakdownRow}>
            <span>Contributor Reward</span>
            <strong>{amountBreakdown.isValid ? adaFormatter.format(amountBreakdown.contributorReward) : "0"} ADA</strong>
          </div>
          <div className={styles.modalBreakdownRow}>
            <span>Platform Fee (10%)</span>
            <strong>{amountBreakdown.isValid ? adaFormatter.format(amountBreakdown.platformFee) : "0"} ADA</strong>
          </div>
          <hr className={styles.modalDivider} />
          <div className={styles.modalBreakdownRow} data-total="true">
            <span>Total Escrow Funding</span>
            <strong>{amountBreakdown.isValid ? adaFormatter.format(amountBreakdown.totalFunding) : "0"} ADA</strong>
          </div>
        </div>

        <p className={styles.modalWarning}>
          Please make sure your Cardano wallet is connected and has sufficient funds to cover the total amount plus transaction fees.
        </p>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.modalCancelButton}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.modalConfirmButton}
            onClick={onConfirm}
          >
            Confirm & Fund
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProcessingEscrowModal({ submitStep }: { submitStep: string }) {
  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${styles.processingContent}`}>
        <div className={styles.spinner} />
        <h3>Processing On-Chain Escrow</h3>
        <p className={styles.stepMessage}>{submitStep}</p>
        <p className={styles.processingNote}>
          Do not close this tab or disconnect your wallet. On-chain validation can take up to a minute.
        </p>
      </div>
    </div>
  );
}
