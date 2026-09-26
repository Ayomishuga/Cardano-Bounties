"use client";

import { authFetch } from "@/lib/api";
import { formatAda, formatDate, normalizeStatus } from "@/lib/formatters";
import type { Bounty } from "@/types/bounty";
import { isEscrowVerificationPending } from "./helpers";
import styles from "../DashboardPage.module.css";

export function BountyTable({
  actionId,
  bounties,
  runAction,
}: {
  actionId: string;
  bounties: Bounty[];
  runAction: (id: string, action: () => Promise<Response>, successMessage: string) => Promise<void>;
}) {
  return (
    <div className={styles.activityTable} role="table" aria-label="Posted bounties">
      <div className={styles.tableHead} role="row">
        <span role="columnheader">Bounty</span>
        <span role="columnheader">Reward</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Updated</span>
      </div>
      {bounties.map((bounty) => (
        <div className={styles.tableRow} role="row" key={bounty.id}>
          <span role="cell" data-label="Bounty">{bounty.title}</span>
          <span role="cell" data-label="Reward">{formatAda(bounty.reward_amount)}</span>
          <span role="cell" data-label="Status">
            <b>{isEscrowVerificationPending(bounty) ? "Escrow Verification Pending" : normalizeStatus(bounty.status)}</b>
            {bounty.escrow_verification_error ? <small>{bounty.escrow_verification_error}</small> : null}
            {isEscrowVerificationPending(bounty) ? (
              <button
                type="button"
                disabled={actionId === `${bounty.id}:verify-escrow`}
                onClick={() =>
                  void runAction(
                    `${bounty.id}:verify-escrow`,
                    () =>
                      authFetch(`/api/bounties/${bounty.id}/escrow/verify`, {
                        method: "POST",
                      }),
                    "Escrow verification checked.",
                  )
                }
              >
                {actionId === `${bounty.id}:verify-escrow` ? "Checking..." : "Retry verification"}
              </button>
            ) : null}
          </span>
          <span role="cell" data-label="Updated">{formatDate(bounty.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
