"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/api";

type UseSubmissionActionReturn = {
  runAction: (id: string, status: "approved" | "rejected", feedback: string) => Promise<boolean>;
  isSubmitting: boolean;
};

/**
 * Handles approve / reject for a single submission.
 * Returns true on success, false on failure.
 * Calls onSuccess so the parent can apply optimistic updates.
 */
export function useSubmissionAction(
  onSuccess: (id: string, status: string, feedback: string) => void,
): UseSubmissionActionReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const runAction = useCallback(
    async (id: string, status: "approved" | "rejected", feedback: string): Promise<boolean> => {
      setIsSubmitting(true);
      try {
        const res = await authFetch(`/api/submissions/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status, feedback }),
        });
        const payload = await res.json().catch(() => ({})) as { error?: string };
        if (!res.ok) throw new Error(payload.error || "Action failed.");
        onSuccess(id, status, feedback);
        return true;
      } catch {
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSuccess],
  );

  return { runAction, isSubmitting };
}
