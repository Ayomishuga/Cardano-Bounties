"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import type { Bounty, Submission as BountySubmission } from "@/types/bounty";
import { formatDate, normalizeStatus, shortId, isValidUrl } from "@/lib/formatters";
import { getProjectName } from "@/lib/bountyHelpers";
import styles from "../BountyDetailsPage.module.css";
import type { DetailTab } from "./types";

export function BriefTab({
  sections,
  fallback,
}: {
  sections: string[];
  fallback?: string | null;
}) {
  return (
    <article className={styles.briefCard}>
      <div className={styles.sectionHeader}>
        <span>Bounty brief</span>
        <h2>What needs to be done</h2>
      </div>

      <div className={styles.briefContent}>
        {(sections.length > 0 ? sections : [fallback || ""]).map((section, index) => (
          <p key={`${section}-${index}`}>{section}</p>
        ))}
      </div>
    </article>
  );
}

export function InstructionsTab({ sections }: { sections: string[] }) {
  return (
    <article className={styles.briefCard}>
      <div className={styles.sectionHeader}>
        <span>Bounty instructions</span>
        <h2>Reward and review rules</h2>
      </div>

      <div className={styles.briefContent}>
        {(sections.length > 0
          ? sections
          : ["No dedicated instructions were added for this bounty."]).map((section, index) => (
          <p key={`${section}-${index}`}>{section}</p>
        ))}
      </div>
    </article>
  );
}

export function ContributionsTab({ submissions }: { submissions: BountySubmission[] }) {
  return (
    <div className={styles.contributorsPanel}>
      <div className={styles.sectionHeader}>
        <span>Contributors</span>
        <h2>Bounty contributions</h2>
        <p>Track who has submitted work for this bounty and where each contribution stands in the review flow.</p>
      </div>

      {submissions.length > 0 ? (
        <div className={styles.contributorTable} role="table" aria-label="Bounty contributors">
          <div className={styles.contributorTableHead} role="row">
            <span role="columnheader">Contributor</span>
            <span role="columnheader">Submission</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Reviewed</span>
          </div>

          {submissions.map((submission) => (
            <div className={styles.contributorTableRow} role="row" key={submission.id}>
              <span role="cell">
                <strong>
                  {shortId(submission.contributor?.stake_address ?? submission.contributor_id) || "Unknown contributor"}
                </strong>
                <small>
                  {submission.contributor?.stake_address ?? submission.contributor_id ?? "Address unavailable"}
                </small>
              </span>
              <span role="cell">{formatDate(submission.submitted_at)}</span>
              <span role="cell">
                <b>{normalizeStatus(submission.status)}</b>
              </span>
              <span role="cell">
                {submission.reviewed_at ? formatDate(submission.reviewed_at) : "Pending"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.contributorEmptyState}>
          <strong>No contributions yet</strong>
          <p>When contributors submit work for this bounty, their submissions will appear here.</p>
        </div>
      )}
    </div>
  );
}

export function SubmitWorkTab({
  acceptsContributions,
  connected,
  isAuthenticated,
  address,
  isSubmitting,
  submissionSuccess,
  submissionError,
  contributionLink,
  setContributionLink,
  contributionNotes,
  setContributionNotes,
  linkError,
  setLinkError,
  handleContributionSubmit,
}: {
  acceptsContributions: boolean;
  connected: boolean;
  isAuthenticated: boolean;
  address?: string | null;
  isSubmitting: boolean;
  submissionSuccess: string;
  submissionError: string;
  contributionLink: string;
  setContributionLink: (val: string) => void;
  contributionNotes: string;
  setContributionNotes: (val: string) => void;
  linkError: string;
  setLinkError: (val: string) => void;
  handleContributionSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <div className={styles.submitGrid}>
      <div className={styles.submitPanel}>
        <div className={styles.sectionHeader}>
          <span>{acceptsContributions ? "Submit work" : "Review status"}</span>
          <h2>{acceptsContributions ? "Send a contribution for review" : "This bounty is in review"}</h2>
          <p>
            {acceptsContributions
              ? "Connect your wallet, then submit a link and reviewer notes. Until signed verification is added, the connected wallet address is used as the contributor identity."
              : "The submission window has closed. Existing contributions are being reviewed and payout allocations are being prepared."}
          </p>
        </div>

        {!acceptsContributions ? (
          <div className={styles.reviewClosedPanel} role="status">
            <strong>No new contributions can be submitted.</strong>
            <span>You can still read the bounty details and track existing contribution statuses.</span>
          </div>
        ) : null}

        {submissionSuccess ? (
          <div className={styles.submissionSuccess} role="status">
            {submissionSuccess}
          </div>
        ) : null}

        {submissionError ? (
          <div className={styles.submissionError} role="alert">
            {submissionError}
          </div>
        ) : null}

        {acceptsContributions ? (
          <form className={styles.submitForm} onSubmit={handleContributionSubmit}>
            <div className={styles.submitField}>
              <label htmlFor="contribution-link">Contribution link</label>
              <input
                id="contribution-link"
                type="text"
                placeholder="https://github.com/example/submission"
                value={contributionLink}
                disabled={!connected || !isAuthenticated || isSubmitting}
                aria-invalid={Boolean(linkError)}
                aria-describedby={linkError ? "contribution-link-error" : undefined}
                onChange={(event) => {
                  setContributionLink(event.target.value);
                  if (linkError) setLinkError("");
                }}
                onBlur={() => {
                  if (contributionLink.trim() && !isValidUrl(contributionLink)) {
                    setLinkError("Please enter a valid URL (must start with http:// or https://).");
                  } else {
                    setLinkError("");
                  }
                }}
              />
              {linkError && (
                <p id="contribution-link-error" role="alert" style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                  {linkError}
                </p>
              )}
            </div>

            <div className={styles.submitField}>
              <label htmlFor="contribution-notes">Reviewer notes</label>
              <textarea
                id="contribution-notes"
                rows={6}
                placeholder="Summarize what you completed and anything the reviewer should know."
                value={contributionNotes}
                disabled={!connected || !isAuthenticated || isSubmitting}
                onChange={(event) => setContributionNotes(event.target.value)}
              />
            </div>

            <div className={styles.submitActions}>
              <button type="submit" disabled={!connected || !isAuthenticated || isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit contribution"}
              </button>
              <span>
                {!connected
                  ? "Connect wallet first"
                  : !isAuthenticated
                    ? "Sign wallet verification first"
                    : `Submitting as ${shortId(address) || "Unknown contributor"}`}
              </span>
            </div>
          </form>
        ) : null}
      </div>

      <aside className={styles.submitGuidance}>
        <span>What reviewers need</span>
        <ul>
          <li>A public link to the completed work.</li>
          <li>A short summary of what changed or was delivered.</li>
          <li>Any setup, testing, or review instructions.</li>
          <li>Original work only, with sources credited where relevant.</li>
        </ul>
      </aside>
    </div>
  );
}

export function BountyMetaTab({ bounty }: { bounty: Bounty }) {
  return (
    <aside className={styles.actionPanel}>
      <span>Contribution flow</span>
      <h2>Ready to work on this?</h2>
      <p>
        Review the brief, complete the work, then submit a contribution link and notes for review. Wallet
        verification will be connected before submissions are sent to the API.
      </p>
      <ol className={styles.contributionSteps}>
        <li>
          <strong>1</strong>
          <span>Read the bounty scope and acceptance criteria.</span>
        </li>
        <li>
          <strong>2</strong>
          <span>Complete the work in a shareable repo, document, design file, or public link.</span>
        </li>
        <li>
          <strong>3</strong>
          <span>Submit your proof of work for poster or admin review.</span>
        </li>
      </ol>
      <div className={styles.metaList}>
        <div>
          <span>Posted</span>
          <strong>{formatDate(bounty.created_at)}</strong>
        </div>
        <div>
          <span>Type</span>
          <strong>{bounty.type || "General"}</strong>
        </div>
        <div>
          <span>Project</span>
          <strong>{getProjectName(bounty)}</strong>
        </div>
        <div>
          <span>Poster</span>
          <strong>{bounty.created_by || "Platform"}</strong>
        </div>
      </div>
      <Link href="/post-bounty">Post similar bounty</Link>
    </aside>
  );
}
