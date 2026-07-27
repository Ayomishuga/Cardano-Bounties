"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/api";
import type { Submission } from "@/types/bounty";

type UseSubmitContributionParams = {
  bountyId: string;
  acceptsContributions: boolean;
  connected: boolean;
  address: string | null;
  isAuthenticated: boolean;
  onSuccess: (newSubmission: Submission) => void;
};

type UseSubmitContributionReturn = {
  contributionLink: string;
  setContributionLink: (val: string) => void;
  contributionNotes: string;
  setContributionNotes: (val: string) => void;
  isSubmitting: boolean;
  submissionError: string;
  submissionSuccess: string;
  submit: (e: React.FormEvent) => Promise<void>;
};

/**
 * Handles contributor work submission for a bounty.
 * Validates wallet connection, authentication, non-empty inputs, and submits to API.
 */
export function useSubmitContribution({
  bountyId,
  acceptsContributions,
  connected,
  address,
  isAuthenticated,
  onSuccess,
}: UseSubmitContributionParams): UseSubmitContributionReturn {
  const [contributionLink, setContributionLink] = useState("");
  const [contributionNotes, setContributionNotes] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(
    async (event: React.FormEvent) => {
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

      setIsSubmitting(true);

      try {
        const contentParts = [
          contributionLink.trim() ? `Link: ${contributionLink.trim()}` : null,
          contributionNotes.trim() ? `Notes: ${contributionNotes.trim()}` : null,
        ].filter(Boolean);

        const response = await authFetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bounty_id: bountyId,
            content: contentParts.join("\n\n"),
          }),
        });

        const data = (await response.json()) as Submission | { error?: string };

        if (!response.ok) {
          throw new Error("error" in data && data.error ? data.error : "Unable to submit contribution.");
        }

        const newSub = data as Submission;
        setContributionLink("");
        setContributionNotes("");
        setSubmissionSuccess("Contribution submitted! The poster and admin will review your work.");
        onSuccess(newSub);
      } catch (err) {
        setSubmissionError(err instanceof Error ? err.message : "Unable to submit contribution.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      acceptsContributions,
      connected,
      address,
      isAuthenticated,
      contributionLink,
      contributionNotes,
      bountyId,
      onSuccess,
    ],
  );

  return {
    contributionLink,
    setContributionLink,
    contributionNotes,
    setContributionNotes,
    isSubmitting,
    submissionError,
    submissionSuccess,
    submit,
  };
}
