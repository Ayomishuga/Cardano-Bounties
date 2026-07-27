"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/api";

/** Tracks per-action loading state using a string key (e.g. `allocationId:create`). */
type ActionState = Record<string, "loading" | "error" | "idle">;

type UseAllocationActionsReturn = {
  startReview: (bountyId: string) => Promise<boolean>;
  createAllocation: (
    bountyId: string,
    submissionId: string,
    amountLovelace: number,
    rank?: number,
  ) => Promise<boolean>;
  updateAllocation: (
    allocationId: string,
    amountLovelace: number,
    rank?: number | null,
  ) => Promise<boolean>;
  cancelAllocation: (allocationId: string) => Promise<boolean>;
  finalizeWinners: (bountyId: string) => Promise<boolean>;
  releasePayment: (allocationId: string, transactionHash: string) => Promise<boolean>;
  actionState: ActionState;
};

/**
 * All write operations for the payouts workspace.
 *
 * Each action returns a boolean: true = success, false = failure.
 * The `onSuccess` callback is called after every successful action so the
 * parent component can refetch data or update its local cache.
 *
 * Error messages are returned via `actionState` keyed by the action's ID,
 * allowing individual rows to show their own error state.
 */
export function useAllocationActions(onSuccess: () => void): UseAllocationActionsReturn {
  const [actionState, setActionState] = useState<ActionState>({});

  function setLoading(key: string) {
    setActionState((prev) => ({ ...prev, [key]: "loading" }));
  }

  function setIdle(key: string) {
    setActionState((prev) => ({ ...prev, [key]: "idle" }));
  }

  function setError(key: string) {
    setActionState((prev) => ({ ...prev, [key]: "error" }));
  }

  const startReview = useCallback(
    async (bountyId: string): Promise<boolean> => {
      const key = `${bountyId}:start-review`;
      setLoading(key);
      try {
        const res = await authFetch(`/api/admin/bounties/${bountyId}/start-review`, {
          method: "POST",
        });
        if (!res.ok) throw new Error();
        onSuccess();
        setIdle(key);
        return true;
      } catch {
        setError(key);
        return false;
      }
    },
    [onSuccess],
  );

  const createAllocation = useCallback(
    async (
      bountyId: string,
      submissionId: string,
      amountLovelace: number,
      rank?: number,
    ): Promise<boolean> => {
      const key = `${submissionId}:create`;
      setLoading(key);
      try {
        const res = await authFetch("/api/admin/allocations", {
          method: "POST",
          body: JSON.stringify({ bounty_id: bountyId, submission_id: submissionId, amount_lovelace: amountLovelace, rank }),
        });
        if (!res.ok) throw new Error();
        onSuccess();
        setIdle(key);
        return true;
      } catch {
        setError(key);
        return false;
      }
    },
    [onSuccess],
  );

  const updateAllocation = useCallback(
    async (
      allocationId: string,
      amountLovelace: number,
      rank?: number | null,
    ): Promise<boolean> => {
      const key = `${allocationId}:update`;
      setLoading(key);
      try {
        const res = await authFetch(`/api/admin/allocations/${allocationId}`, {
          method: "PATCH",
          body: JSON.stringify({ amount_lovelace: amountLovelace, rank }),
        });
        if (!res.ok) throw new Error();
        onSuccess();
        setIdle(key);
        return true;
      } catch {
        setError(key);
        return false;
      }
    },
    [onSuccess],
  );

  const cancelAllocation = useCallback(
    async (allocationId: string): Promise<boolean> => {
      const key = `${allocationId}:cancel`;
      setLoading(key);
      try {
        const res = await authFetch(`/api/admin/allocations/${allocationId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error();
        onSuccess();
        setIdle(key);
        return true;
      } catch {
        setError(key);
        return false;
      }
    },
    [onSuccess],
  );

  const finalizeWinners = useCallback(
    async (bountyId: string): Promise<boolean> => {
      const key = `${bountyId}:finalize`;
      setLoading(key);
      try {
        const res = await authFetch(`/api/admin/bounties/${bountyId}/finalize-winners`, {
          method: "POST",
        });
        if (!res.ok) throw new Error();
        onSuccess();
        setIdle(key);
        return true;
      } catch {
        setError(key);
        return false;
      }
    },
    [onSuccess],
  );

  const releasePayment = useCallback(
    async (allocationId: string, transactionHash: string): Promise<boolean> => {
      const key = `${allocationId}:release`;
      setLoading(key);
      try {
        const res = await authFetch("/api/admin/release-payment", {
          method: "POST",
          body: JSON.stringify({ allocation_id: allocationId, transaction_hash: transactionHash }),
        });
        if (!res.ok) throw new Error();
        onSuccess();
        setIdle(key);
        return true;
      } catch {
        setError(key);
        return false;
      }
    },
    [onSuccess],
  );

  return {
    startReview,
    createAllocation,
    updateAllocation,
    cancelAllocation,
    finalizeWinners,
    releasePayment,
    actionState,
  };
}
