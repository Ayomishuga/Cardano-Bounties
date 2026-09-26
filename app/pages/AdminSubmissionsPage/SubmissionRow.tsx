"use client";

import type { Submission } from "@/types/bounty";
import { formatAda, formatRelativeTime } from "@/lib/formatters";
import { getSubmissionBounty } from "@/lib/bountyHelpers";
import { getSubmitterHandle } from "./types";
import { StatusPill } from "@/components/shared/StatusPill";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import styles from "../AdminQueue.module.css";

export function SubmissionRow({
  submission,
  onRowClick,
}: {
  submission: Submission;
  onRowClick: (id: string) => void;
}) {
  const handle = getSubmitterHandle(submission);
  const bounty = getSubmissionBounty(submission);

  return (
    <tr
      onClick={() => onRowClick(submission.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowClick(submission.id);
        }
      }}
    >
      <td>
        <div className={styles.submitter}>
          <InitialsAvatar name={handle} />
          <span className={styles.handle} title={handle}>
            {handle}
          </span>
        </div>
      </td>
      <td>
        <span className={styles.bountyTitle} title={bounty?.title}>
          {bounty?.title || "Unknown Bounty"}
        </span>
      </td>
      <td>
        <div className={styles.amount}>{formatAda(bounty?.reward_amount)}</div>
      </td>
      <td>
        <StatusPill status={submission.status} />
      </td>
      <td>
        <span
          className={styles.date}
          title={submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : undefined}
        >
          {formatRelativeTime(submission.submitted_at)}
        </span>
      </td>
      <td>
        <div className={styles.actions}>
          <button
            type="button"
            aria-label="View submission"
            tabIndex={-1}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
