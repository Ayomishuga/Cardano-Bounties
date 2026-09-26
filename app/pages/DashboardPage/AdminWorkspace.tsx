"use client";

import { useMemo, useState } from "react";
import { authFetch } from "@/lib/api";
import { formatAda, formatDate, formatRelativeTime, normalizeStatus, shortId } from "@/lib/formatters";
import { ContentWithLinks } from "@/components/shared/ContentWithLinks";
import type { Bounty, Submission } from "@/types/bounty";
import type { AdminTab } from "./types";
import { adminTabs } from "./types";
import {
  groupSubmissionsByBounty,
  getSubmissionBounty,
  isOlderThanHours,
  getBountySubmissions,
  getSubmissionProgress,
  getFundingState,
} from "./helpers";
import styles from "../DashboardPage.module.css";

export function AdminWorkspace({
  actionId,
  activeTab,
  allBounties,
  approvalBounties,
  selectedApprovalId,
  selectedBountyId,
  selectedSubmissionId,
  setSelectedApprovalId,
  setSelectedBountyId,
  setSelectedSubmissionId,
  submissions,
  updateAdminTab,
  runAction,
}: {
  actionId: string;
  activeTab: AdminTab;
  allBounties: Bounty[];
  approvalBounties: Bounty[];
  selectedApprovalId: string;
  selectedBountyId: string;
  selectedSubmissionId: string;
  setSelectedApprovalId: (id: string) => void;
  setSelectedBountyId: (id: string) => void;
  setSelectedSubmissionId: (id: string) => void;
  submissions: Submission[];
  updateAdminTab: (tab: AdminTab) => void;
  runAction: (id: string, action: () => Promise<Response>, successMessage: string) => Promise<void>;
}) {
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [adminNote, setAdminNote] = useState("");
  const sortedApprovalBounties = useMemo(
    () =>
      [...approvalBounties].sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
      ),
    [approvalBounties],
  );
  const groupedSubmissions = useMemo(() => groupSubmissionsByBounty(submissions), [submissions]);
  const visibleBounties = useMemo(
    () =>
      statusFilters.length > 0
        ? allBounties.filter((bounty) => statusFilters.includes(bounty.status))
        : allBounties,
    [allBounties, statusFilters],
  );

  const selectedApproval = sortedApprovalBounties.find((bounty) => bounty.id === selectedApprovalId) || null;
  const selectedSubmission = submissions.find((submission) => submission.id === selectedSubmissionId) || null;
  const selectedBounty = visibleBounties.find((bounty) => bounty.id === selectedBountyId) || null;
  const statuses = [...new Set(allBounties.map((bounty) => bounty.status))];

  function toggleStatusFilter(status: string) {
    setStatusFilters((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status],
    );
  }

  return (
    <section className={styles.adminWorkspace} aria-label="Admin workspace">
      <div className={styles.workspaceTabs} role="tablist" aria-label="Admin review tabs">
        {adminTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? styles.activeWorkspaceTab : undefined}
            key={tab.id}
            role="tab"
            type="button"
            onClick={() => updateAdminTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.reviewWorkspace}>
        <aside className={styles.reviewListPane}>
          {activeTab === "approval" ? (
            <>
              <div className={styles.listPaneHeader}>
                <span>Oldest first</span>
                <strong>{sortedApprovalBounties.length} pending</strong>
              </div>
              <div className={styles.reviewList}>
                {sortedApprovalBounties.length > 0 ? (
                  sortedApprovalBounties.map((bounty) => (
                    <button
                      className={selectedApprovalId === bounty.id ? styles.selectedReviewRow : undefined}
                      key={bounty.id}
                      type="button"
                      onClick={() => setSelectedApprovalId(bounty.id)}
                    >
                      <strong>{bounty.title}</strong>
                      <span>{formatAda(bounty.reward_amount)} · {shortId(bounty.poster?.stake_address || bounty.created_by)}</span>
                      <small>
                        {formatRelativeTime(bounty.created_at)}
                        {isOlderThanHours(bounty.created_at, 24) ? " · urgent" : ""}
                      </small>
                    </button>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <h2>No bounty approvals</h2>
                    <p>Funded bounty approvals will appear here.</p>
                  </div>
                )}
              </div>
            </>
          ) : null}

          {activeTab === "submissions" ? (
            <div className={styles.submissionReviewList}>
              {groupedSubmissions.length > 0 ? (
                groupedSubmissions.map((group) => (
                  <section key={group.bounty?.id || group.submissions[0]?.bounty_id || "unknown"}>
                    <header>{group.bounty?.title || "Unlinked bounty"}</header>
                    {group.submissions.map((submission) => (
                      <button
                        className={selectedSubmissionId === submission.id ? styles.selectedReviewRow : undefined}
                        key={submission.id}
                        type="button"
                        onClick={() => setSelectedSubmissionId(submission.id)}
                      >
                        <strong>{shortId(submission.contributor_id)}</strong>
                        <span>{formatRelativeTime(submission.submitted_at || submission.created_at)}</span>
                        <small>Poster {normalizeStatus(submission.poster_review_status)}</small>
                      </button>
                    ))}
                  </section>
                ))
              ) : (
                <div className={styles.emptyState}>
                  <h2>No submissions</h2>
                  <p>Poster-approved submissions will appear here for final review.</p>
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "bounties" ? (
            <>
              <div className={styles.statusFilters}>
                {statuses.map((status) => (
                  <button
                    className={statusFilters.includes(status) ? styles.selectedStatusFilter : undefined}
                    key={status}
                    type="button"
                    onClick={() => toggleStatusFilter(status)}
                  >
                    {normalizeStatus(status)}
                  </button>
                ))}
              </div>
              <div className={styles.reviewList}>
                {visibleBounties.length > 0 ? (
                  visibleBounties.map((bounty) => (
                    <button
                      className={selectedBountyId === bounty.id ? styles.selectedReviewRow : undefined}
                      key={bounty.id}
                      type="button"
                      onClick={() => setSelectedBountyId(bounty.id)}
                    >
                      <strong>{bounty.title}</strong>
                      <span>{formatAda(bounty.reward_amount)} · {normalizeStatus(bounty.status)}</span>
                      <small>{getBountySubmissions(bounty).length} submissions</small>
                      <i aria-hidden="true">
                        <b style={{ width: `${getSubmissionProgress(bounty)}%` }} />
                      </i>
                    </button>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <h2>No matching bounties</h2>
                    <p>Clear status filters to show every bounty.</p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </aside>

        <section className={styles.reviewDetailPane}>
          {activeTab === "approval" ? (
            <ApprovalDetail bounty={selectedApproval} actionId={actionId} runAction={runAction} />
          ) : null}
          {activeTab === "submissions" ? (
            <SubmissionReviewDetail
              actionId={actionId}
              adminNote={adminNote}
              setAdminNote={setAdminNote}
              submission={selectedSubmission}
              runAction={runAction}
            />
          ) : null}
          {activeTab === "bounties" ? (
            <AllBountyDetail bounty={selectedBounty} updateAdminTab={updateAdminTab} />
          ) : null}
        </section>
      </div>
    </section>
  );
}

function DetailEmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className={styles.detailEmptyState}>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

function ApprovalDetail({
  bounty,
  actionId,
  runAction,
}: {
  bounty: Bounty | null;
  actionId: string;
  runAction: (id: string, action: () => Promise<Response>, successMessage: string) => Promise<void>;
}) {
  if (!bounty) {
    return <DetailEmptyState title="Select a bounty" message="Choose a funded bounty from the approval queue." />;
  }

  return (
    <div className={styles.detailStack}>
      <section className={styles.detailSection}>
        <div className={styles.detailTitleRow}>
          <div>
            <span>{normalizeStatus(bounty.status)}</span>
            <h2>{bounty.title}</h2>
          </div>
          <strong>{formatAda(bounty.reward_amount)}</strong>
        </div>
        <p>{bounty.type || "General"} · locked in escrow</p>
        {bounty.escrow_tx_hash ? (
          <a href={`https://preprod.cardanoscan.io/transaction/${bounty.escrow_tx_hash}`} rel="noreferrer" target="_blank">
            {shortId(bounty.escrow_tx_hash)}
          </a>
        ) : null}
      </section>

      <section className={styles.detailSection}>
        <span>Description</span>
        <p>{bounty.description || "No description provided."}</p>
      </section>

      <section className={styles.detailGrid}>
        <div><span>Reward</span><strong>{formatAda(bounty.reward_amount)}</strong></div>
        <div><span>Deadline</span><strong>{formatDate(bounty.created_at)}</strong></div>
        <div><span>Escrow</span><strong>{getFundingState(bounty)}</strong></div>
        <div><span>Poster</span><strong>{shortId(bounty.poster?.stake_address || bounty.created_by)}</strong></div>
      </section>

      <section className={styles.detailSection}>
        <span>Admin checklist</span>
        <label><input type="checkbox" /> Scope is clear</label>
        <label><input type="checkbox" /> Reward matches effort</label>
        <label><input type="checkbox" /> Escrow transaction is present</label>
        <label><input type="checkbox" /> Public brief is safe</label>
        <label><input type="checkbox" /> Instructions are actionable</label>
      </section>

      <div className={styles.detailActionBar}>
        <button
          type="button"
          disabled={actionId === `${bounty.id}:rejected`}
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
        <button type="button">Message poster</button>
        <button
          type="button"
          disabled={actionId === `${bounty.id}:open`}
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
      </div>
    </div>
  );
}

function SubmissionReviewDetail({
  actionId,
  adminNote,
  setAdminNote,
  submission,
  runAction,
}: {
  actionId: string;
  adminNote: string;
  setAdminNote: (value: string) => void;
  submission: Submission | null;
  runAction: (id: string, action: () => Promise<Response>, successMessage: string) => Promise<void>;
}) {
  const bounty = submission ? getSubmissionBounty(submission) : null;

  if (!submission) {
    return <DetailEmptyState title="Select a submission" message="Choose a contributor submission for final admin review." />;
  }

  return (
    <div className={styles.detailStack}>
      <div className={styles.stepStrip} aria-label="Submission progress">
        <span>Hunter submits</span>
        <span>Poster reviews</span>
        <span>Admin final review</span>
        <span>Payout</span>
      </div>
      <section className={styles.detailSection}>
        <span>{bounty?.title || "Unlinked bounty"}</span>
        <h2>{shortId(submission.contributor_id)}</h2>
        <p>{formatRelativeTime(submission.submitted_at || submission.created_at)}</p>
      </section>
      <section className={styles.detailSection}>
        <span>Contributor note</span>
        <p><ContentWithLinks content={submission.content} linkClassName={styles.contentLink} /></p>
      </section>
      <section className={styles.noticeSection}>
        <span>Poster review note</span>
        <p>{submission.poster_feedback || normalizeStatus(submission.poster_review_status)}</p>
      </section>
      <section className={styles.detailSection}>
        <label htmlFor="admin-note">Admin note</label>
        <textarea
          id="admin-note"
          placeholder="Add an internal note for this final review."
          value={adminNote}
          onChange={(event) => setAdminNote(event.target.value)}
        />
      </section>
      <div className={styles.detailActionBar}>
        <button
          type="button"
          disabled={actionId === `${submission.id}:reject`}
          onClick={() =>
            void runAction(
              `${submission.id}:reject`,
              () =>
                authFetch(`/api/submissions/${submission.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ status: "rejected", feedback: adminNote }),
                }),
              "Submission rejected.",
            )
          }
        >
          Reject
        </button>
        <button type="button">Dispute</button>
        <button
          type="button"
          disabled={actionId === `${submission.id}:approve`}
          onClick={() =>
            void runAction(
              `${submission.id}:approve`,
              () =>
                authFetch(`/api/submissions/${submission.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ status: "approved", feedback: adminNote }),
                }),
              "Submission approved for payout.",
            )
          }
        >
          Approve
        </button>
      </div>
    </div>
  );
}

function AllBountyDetail({
  bounty,
  updateAdminTab,
}: {
  bounty: Bounty | null;
  updateAdminTab: (tab: AdminTab) => void;
}) {
  if (!bounty) {
    return <DetailEmptyState title="Select a bounty" message="Choose a bounty to inspect its lifecycle and submissions." />;
  }

  const submissions = getBountySubmissions(bounty);
  const approved = submissions.filter((submission) => ["approved", "paid"].includes(submission.status)).length;
  const pending = submissions.filter((submission) => submission.status === "pending").length;
  const rejected = submissions.filter((submission) => submission.status === "rejected").length;

  return (
    <div className={styles.detailStack}>
      <section className={styles.detailSection}>
        <div className={styles.detailTitleRow}>
          <div>
            <span>{normalizeStatus(bounty.status)}</span>
            <h2>{bounty.title}</h2>
          </div>
          <strong>{formatAda(bounty.reward_amount)}</strong>
        </div>
        <div className={styles.progressTrack} aria-label={`${getSubmissionProgress(bounty)} percent accepted`}>
          <i style={{ width: `${getSubmissionProgress(bounty)}%` }} />
        </div>
      </section>
      <section className={styles.detailGrid}>
        <div><span>Poster</span><strong>{shortId(bounty.poster?.stake_address || bounty.created_by)}</strong></div>
        <div><span>Posted</span><strong>{formatDate(bounty.created_at)}</strong></div>
        <div><span>Deadline</span><strong>{formatDate(bounty.created_at)}</strong></div>
        <div><span>Escrow tx</span><strong>{shortId(bounty.escrow_tx_hash)}</strong></div>
      </section>
      <section className={styles.detailSection}>
        <span>Submission breakdown</span>
        <button type="button" onClick={() => updateAdminTab("submissions")}>Pending: {pending}</button>
        <button type="button" onClick={() => updateAdminTab("submissions")}>Approved: {approved}</button>
        <button type="button" onClick={() => updateAdminTab("submissions")}>Rejected: {rejected}</button>
      </section>
      <section className={styles.timeline}>
        <span>Lifecycle</span>
        <p><i /> Created {formatRelativeTime(bounty.created_at)}</p>
        <p><i /> Escrow {bounty.escrow_confirmed_at ? `confirmed ${formatRelativeTime(bounty.escrow_confirmed_at)}` : getFundingState(bounty)}</p>
        <p><i /> Status {normalizeStatus(bounty.status)}</p>
      </section>
      <div className={styles.detailActionBar}>
        <button type="button">Close bounty</button>
        <button type="button">Edit</button>
        <button type="button" onClick={() => updateAdminTab("submissions")}>Review submissions</button>
      </div>
    </div>
  );
}
