"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { useAppWallet } from "@/components/wallet/WalletProvider";
import { authFetch } from "@/lib/api";
import styles from "./BountyDetailsPage.module.css";

import { type Bounty, type Submission as BountySubmission } from "@/types/bounty";
import { formatAda, formatDate, normalizeStatus, shortId, isValidUrl } from "@/lib/formatters";
import { isAcceptingContributions, getBountyState, getProjectName, getProjectLogoUrl } from "@/lib/bountyHelpers";

type DetailTab = "brief" | "instructions" | "contributions" | "submit" | "details";

function splitBrief(description: string) {
  return description
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function BountyDetailsPage({ bountyId }: { bountyId: string }) {
  const { address, connected, isAuthenticated } = useAppWallet();
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [contributionLink, setContributionLink] = useState("");
  const [contributionNotes, setContributionNotes] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("brief");
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadBounty() {
      try {
        setIsLoading(true);
        setError("");

        const response = await authFetch(`/api/bounties/${bountyId}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        const data = (await response.json()) as Bounty | { error?: string };

        if (!response.ok) {
          throw new Error("error" in data && data.error ? data.error : "Unable to load bounty.");
        }

        if (isMounted) setBounty(data as Bounty);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : "Unable to load bounty.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadBounty();

    return () => {
      isMounted = false;
    };
  }, [bountyId]);

  const briefSections = useMemo(() => splitBrief(bounty?.description || ""), [bounty?.description]);
  const instructionSections = useMemo(
    () => splitBrief(bounty?.bounty_instructions || ""),
    [bounty?.bounty_instructions],
  );
  const submissions = bounty?.submissions || [];
  const acceptsContributions = isAcceptingContributions(bounty?.status);
  const detailTabs = useMemo(
    () =>
      [
        { id: "brief", label: "Brief" },
        { id: "instructions", label: "Instructions" },
        { id: "contributions", label: `Contributions (${submissions.length})` },
        { id: "submit", label: acceptsContributions ? "Submit work" : "Review status" },
        { id: "details", label: "Details" },
      ] satisfies { id: DetailTab; label: string }[],
    [acceptsContributions, submissions.length],
  );

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    const lastIndex = detailTabs.length - 1;
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    if (event.key === "ArrowLeft") nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lastIndex;

    if (nextIndex !== currentIndex) {
      event.preventDefault();
      setActiveTab(detailTabs[nextIndex].id);
      document.getElementById(`bounty-tab-${detailTabs[nextIndex].id}`)?.focus();
    }
  }

  async function handleContributionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionError("");
    setSubmissionSuccess("");

    if (!acceptsContributions) {
      setSubmissionError("This bounty is in review and is no longer accepting contributions.");
      return;
    }

    if (!connected || !address) {
      setSubmissionError("Connect a wallet before submitting a contribution.");
      return;
    }

    if (!isAuthenticated) {
      setSubmissionError("Please sign in to authenticate your wallet before submitting your work.");
      return;
    }

    if (!contributionLink.trim() && !contributionNotes.trim()) {
      setSubmissionError("Add a contribution link or reviewer notes before submitting.");
      return;
    }

    if (contributionLink.trim() && !isValidUrl(contributionLink)) {
      setLinkError("Please enter a valid URL (must start with http:// or https://).");
      return;
    }

    setIsSubmitting(true);

    try {
      const content = [
        contributionLink.trim() ? `Contribution link: ${contributionLink.trim()}` : "",
        contributionNotes.trim() ? `Notes:\n${contributionNotes.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await authFetch("/api/submissions", {
        method: "POST",
        body: JSON.stringify({ bounty_id: bountyId, content }),
      });

      const data = (await response.json()) as BountySubmission | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Unable to submit contribution.");
      }

      const createdSubmission = data as BountySubmission;
      setBounty((current) =>
        current
          ? {
            ...current,
            submissions: [createdSubmission, ...(current.submissions || [])],
          }
          : current,
      );
      setContributionLink("");
      setContributionNotes("");
      setSubmissionSuccess("Contribution submitted for review.");
    } catch (err) {
      setSubmissionError(err instanceof Error ? err.message : "Unable to submit contribution.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={`page ${styles.detailsPage}`}>
      <Header />

      {isLoading ? (
        <section className={styles.stateSection}>
          <div className={`container ${styles.stateCard}`}>
            <span>Loading bounty</span>
            <h1>Fetching bounty details...</h1>
            <p>We are loading the current brief, reward, and deadline.</p>
          </div>
        </section>
      ) : error || !bounty ? (
        <section className={styles.stateSection}>
          <div className={`container ${styles.stateCard}`}>
            <span>Bounty unavailable</span>
            <h1>{error || "Bounty not found"}</h1>
            <p>This bounty may have been closed, cancelled, or removed from the public board.</p>
            <Link href="/explore">Back to bounties</Link>
          </div>
        </section>
      ) : (
        <>
          <section className={styles.detailsHero}>
            <div className={`container ${styles.detailsHeroGrid}`}>
              <div className={styles.detailsHeroCopy}>
                <span className="eyebrow">
                  <i /> {bounty.type || "Bounty"}
                </span>
                <div className={styles.projectIdentity}>
                  <span aria-hidden="true" className={styles.projectLogo}>
                    {getProjectLogoUrl(bounty) && (
                      <Image
                        src={getProjectLogoUrl(bounty)}
                        alt=""
                        width={40}
                        height={40}
                        className={styles.projectLogoImg}
                        unoptimized
                      />
                    )}
                  </span>
                  <strong>{getProjectName(bounty)}</strong>
                </div>
                <h1>{bounty.title}</h1>
                <p>{briefSections[0] || bounty.description}</p>
                <div className={styles.heroActions}>
                  <Link href="/explore">Back to explore</Link>
                  <a href="#bounty-details-tabs" onClick={() => setActiveTab(acceptsContributions ? "submit" : "details")}>
                    {acceptsContributions ? "Submit work" : "View review status"}
                  </a>
                </div>
              </div>

              <aside className={styles.summaryCard} aria-label="Bounty summary">
                <div>
                  <span>{bounty.payout_type === "equal_split" ? `Reward pool (${bounty.max_winners ?? 2} winners)` : bounty.payout_type === "manual_split" ? `Prize pool (${bounty.max_winners ?? 2} winners)` : "Reward"}</span>
                  <strong>{formatAda(bounty.reward_amount)}</strong>
                </div>

                {/* Payout type badge */}
                {bounty.payout_type && bounty.payout_type !== "single" && (
                  <div style={{ paddingTop: 0, paddingBottom: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--blue)" }}>
                      {bounty.payout_type === "equal_split" ? "Equal split" : "Ranked prizes"}
                    </span>
                  </div>
                )}

                {/* Prize breakdown table for manual_split */}
                {bounty.payout_type === "manual_split" && bounty.prize_structure && bounty.prize_structure.length > 0 && (
                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>Prize breakdown</span>
                    {bounty.prize_structure.map((p) => {
                      const RANK_EMOJI: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
                      const emoji = RANK_EMOJI[p.rank] ?? `#${p.rank}`;
                      const ada = (p.amount_lovelace / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 6 });
                      return (
                        <div key={p.rank} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span>{emoji} {p.rank === 1 ? "1st" : p.rank === 2 ? "2nd" : p.rank === 3 ? "3rd" : `${p.rank}th`} place</span>
                          <strong>{ada} ADA</strong>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div>
                  <span>Deadline</span>
                  <strong>{formatDate(bounty.deadline)}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{getBountyState(bounty)}</strong>
                </div>
                {!acceptsContributions ? (
                  <div className={styles.reviewStatusNotice}>
                    <span>Submissions closed</span>
                    <strong>This bounty is in review and no longer accepting contributions.</strong>
                  </div>
                ) : null}
                <button
                  type="button"
                  className={styles.submitWorkButton}
                  onClick={() => {
                    setActiveTab("submit");
                    const element = document.getElementById("bounty-details-tabs");
                    if (element) {
                      element.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                >
                  {acceptsContributions ? "Submit Work" : "View Review Status"}
                </button>
              </aside>
            </div>
          </section>

          <section className={styles.detailsBody} id="bounty-details-tabs">
            <div className={`container ${styles.tabShell}`}>
              <div className={styles.tabList} role="tablist" aria-label="Bounty details">
                {detailTabs.map((tab, index) => (
                  <button
                    aria-controls={activeTab === tab.id ? `bounty-panel-${tab.id}` : undefined}
                    aria-selected={activeTab === tab.id}
                    className={activeTab === tab.id ? styles.activeTab : undefined}
                    id={`bounty-tab-${tab.id}`}
                    key={tab.id}
                    role="tab"
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div
                aria-labelledby={`bounty-tab-${activeTab}`}
                className={styles.tabPanel}
                id={`bounty-panel-${activeTab}`}
                role="tabpanel"
                tabIndex={0}
              >
                {activeTab === "brief" ? (
                  <article className={styles.briefCard}>
                    <div className={styles.sectionHeader}>
                      <span>Bounty brief</span>
                      <h2>What needs to be done</h2>
                    </div>

                    <div className={styles.briefContent}>
                      {(briefSections.length > 0 ? briefSections : [bounty.description]).map((section, index) => (
                        <p key={`${section}-${index}`}>{section}</p>
                      ))}
                    </div>
                  </article>
                ) : null}

                {activeTab === "instructions" ? (
                  <article className={styles.briefCard}>
                    <div className={styles.sectionHeader}>
                      <span>Bounty instructions</span>
                      <h2>Reward and review rules</h2>
                    </div>

                    <div className={styles.briefContent}>
                      {(instructionSections.length > 0
                        ? instructionSections
                        : ["No dedicated instructions were added for this bounty."]).map((section, index) => (
                        <p key={`${section}-${index}`}>{section}</p>
                      ))}
                    </div>
                  </article>
                ) : null}

                {activeTab === "contributions" ? (
                  <div className={styles.contributorsPanel}>
                    <div className={styles.sectionHeader}>
                      <span>Contributors</span>
                      <h2>Bounty contributions</h2>
                      <p>
                        Track who has submitted work for this bounty and where each contribution stands in the review
                        flow.
                      </p>
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
                                {shortId(
                                  submission.contributor?.stake_address ?? submission.contributor_id
                                ) || "Unknown contributor"}
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
                ) : null}

                {activeTab === "submit" ? (
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
                            aria-invalid={!!linkError}
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
                            <p
                              id="contribution-link-error"
                              role="alert"
                              style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}
                            >
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
                ) : null}

                {activeTab === "details" ? (
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
                ) : null}
              </div>
            </div>
          </section>
        </>
      )}

      <Footer />
    </main>
  );
}
