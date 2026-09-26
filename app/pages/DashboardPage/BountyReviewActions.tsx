"use client";

import { authFetch } from "@/lib/api";
import type { Bounty } from "@/types/bounty";
import { canAdminReviewBounty } from "./helpers";
import styles from "../DashboardPage.module.css";

export function BountyReviewActions({
  bounty,
  actionId,
  runAction,
}: {
  bounty: Bounty;
  actionId: string;
  runAction: (id: string, action: () => Promise<Response>, successMessage: string) => Promise<void>;
}) {
  const reviewReady = canAdminReviewBounty(bounty);

  return (
    <div className={styles.rowActions}>
      <button
        type="button"
        disabled={!reviewReady || actionId === `${bounty.id}:open`}
        title={reviewReady ? "Approve and publish bounty" : "Bounty must have confirmed escrow before approval"}
        onClick={() =>
          void runAction(
            `${bounty.id}:open`,
            () =>
              authFetch(`/api/bounties/${bounty.id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "open" }),
              }),
            "Bounty approved and opened.",
          )
        }
      >
        Approve
      </button>
      <button
        type="button"
        disabled={!reviewReady || actionId === `${bounty.id}:rejected`}
        title={reviewReady ? "Reject bounty" : "Bounty must be in admin review before rejection"}
        onClick={() =>
          void runAction(
            `${bounty.id}:rejected`,
            () =>
              authFetch(`/api/bounties/${bounty.id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "rejected" }),
              }),
            "Bounty rejected.",
          )
        }
      >
        Reject
      </button>
    </div>
  );
}
