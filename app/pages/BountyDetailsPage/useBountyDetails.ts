"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useAppWallet } from "@/components/wallet/WalletProvider";
import { authFetch } from "@/lib/api";
import type { Bounty, Submission as BountySubmission } from "@/types/bounty";
import { isValidUrl } from "@/lib/formatters";
import { isAcceptingContributions } from "@/lib/bountyHelpers";
import type { DetailTab } from "./types";
import { splitBrief } from "./types";

export function useBountyDetails(bountyId: string) {
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

  return {
    address,
    connected,
    isAuthenticated,
    bounty,
    setBounty,
    isLoading,
    error,
    contributionLink,
    setContributionLink,
    contributionNotes,
    setContributionNotes,
    submissionError,
    submissionSuccess,
    isSubmitting,
    activeTab,
    setActiveTab,
    linkError,
    setLinkError,
    briefSections,
    instructionSections,
    submissions,
    acceptsContributions,
    detailTabs,
    handleTabKeyDown,
    handleContributionSubmit,
  };
}
