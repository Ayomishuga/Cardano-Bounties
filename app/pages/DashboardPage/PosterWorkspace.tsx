"use client";

import { authFetch } from "@/lib/api";
import { formatAda, normalizeStatus } from "@/lib/formatters";
import type { Bounty, Submission } from "@/types/bounty";
import { getSubmissionBounty, getPosterLabel, getFundingState, getBountyLifecycleNote } from "./helpers";
import { BountyReviewActions } from "./BountyReviewActions";
import { BountyTable } from "./BountyTable";
import styles from "../DashboardPage.module.css";

export function PosterWorkspace({
  primaryQueue,
  primaryQueueTitle,
  actionId,
  runAction,
  loadDashboard,
  bounties,
}: {
  primaryQueue: (Bounty | Submission)[];
  primaryQueueTitle: string;
  actionId: string;
  runAction: (id: string, action: () => Promise<Response>, successMessage: string) => Promise<void>;
  loadDashboard: () => Promise<void>;
  bounties: Bounty[];
}) {
  return (
    <>
      <section className={styles.workspaceGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Queue</span>
              <h2>{primaryQueueTitle}</h2>
            </div>
            <button type="button" onClick={() => void loadDashboard()}>Refresh</button>
          </div>

          <div className={styles.queueList}>
            {primaryQueue.length > 0 ? (
              primaryQueue.map((item) =>
                false ? (
                  <article className={styles.queueItem} key={(item as Bounty).id}>
                    <div>
                      <h3>{(item as Bounty).title}</h3>
                      <p>Posted by {getPosterLabel(item as Bounty)} · {getFundingState(item as Bounty)}</p>
                      <small className={styles.lifecycleNote}>{getBountyLifecycleNote(item as Bounty)}</small>
                    </div>
                    <span>{formatAda((item as Bounty).reward_amount)}</span>
                    <BountyReviewActions bounty={item as Bounty} actionId={actionId} runAction={runAction} />
                  </article>
                ) : (
                  <article className={styles.queueItem} key={(item as Submission).id}>
                    <div>
                      <h3>{getSubmissionBounty(item as Submission)?.title || "Submission"}</h3>
                      <p>{(item as Submission).content || "No submission notes"}</p>
                    </div>
                    <span>{normalizeStatus((item as Submission).poster_review_status)}</span>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        disabled={actionId === `${(item as Submission).id}:recommended_approval`}
                        onClick={() =>
                          void runAction(
                            `${(item as Submission).id}:recommended_approval`,
                            () =>
                              authFetch(`/api/submissions/${(item as Submission).id}/poster-review`, {
                                method: "PATCH",
                                body: JSON.stringify({ status: "recommended_approval" }),
                              }),
                            "Submission recommended for admin approval.",
                          )
                        }
                      >
                        Recommend
                      </button>
                      <button
                        type="button"
                        disabled={actionId === `${(item as Submission).id}:changes_requested`}
                        onClick={() =>
                          void runAction(
                            `${(item as Submission).id}:changes_requested`,
                            () =>
                              authFetch(`/api/submissions/${(item as Submission).id}/poster-review`, {
                                method: "PATCH",
                                body: JSON.stringify({ status: "changes_requested" }),
                              }),
                            "Submission marked for changes.",
                          )
                        }
                      >
                        Changes
                      </button>
                    </div>
                  </article>
                ),
              )
            ) : (
              <div className={styles.emptyState}>
                <h2>No items waiting</h2>
                <p>The current review queue is clear.</p>
              </div>
            )}
          </div>
        </div>

        <aside className={styles.healthPanel}>
          <span>Operational health</span>
          <strong>{primaryQueue.length === 0 ? "Clear" : primaryQueue.length}</strong>
          <div className={styles.progressTrack} aria-hidden="true">
            <i style={{ width: primaryQueue.length === 0 ? "100%" : "54%" }} />
          </div>
          <p>
            Poster review recommendations help admin process submissions and payouts faster.
          </p>
        </aside>
      </section>

      <section className={styles.tablePanel}>
        <div className={styles.panelHeader}>
          <div>
            <span>Bounties</span>
            <h2>My posted bounties</h2>
          </div>
        </div>
        <BountyTable
          actionId={actionId}
          bounties={bounties}
          runAction={runAction}
        />
      </section>
    </>
  );
}
