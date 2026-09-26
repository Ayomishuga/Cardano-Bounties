import { LOVELACE_PER_ADA } from "@/lib/bountyContract";
import type { AllocationStatus } from "@/types/bounty";
import type { AdminPayoutAllocation, AdminPayoutBounty, PayoutStage } from "../types";

export const PAYOUT_MANAGEMENT_STATUSES = [
  "open",
  "in_review",
  "payout_pending",
  "partially_paid",
  "completed",
] as const;

export function lovelaceToAda(lovelace: number | string | null | undefined): number {
  return Number(lovelace || 0) / LOVELACE_PER_ADA;
}

export function rewardToLovelace(rewardAda: number | string | null | undefined): number {
  return Math.round(Number(rewardAda || 0) * LOVELACE_PER_ADA);
}

export function getPayoutStage(bounty: AdminPayoutBounty): PayoutStage {
  const allocations = bounty.allocations ?? [];
  const activeAllocations = allocations.filter((allocation) => allocation.status !== "cancelled");

  if (bounty.status === "completed") return "completed";
  if (activeAllocations.some((allocation) => allocation.status === "failed")) return "needs_attention";
  if (activeAllocations.some((allocation) => allocation.status === "processing")) return "awaiting_confirmation";

  if (bounty.status === "payout_pending" || bounty.status === "partially_paid") return "ready_to_pay";

  const rewardLovelace = rewardToLovelace(bounty.reward_amount);
  const allocatedTotal = getAllocatedLovelace(activeAllocations);
  if (bounty.status === "in_review" && activeAllocations.length > 0 && allocatedTotal === rewardLovelace) {
    return "ready_to_finalize";
  }

  return "needs_allocation";
}

export function getAllocatedLovelace(allocations: AdminPayoutAllocation[]): number {
  return allocations
    .filter((allocation) => allocation.status !== "cancelled")
    .reduce((sum, allocation) => sum + Number(allocation.amount_lovelace || 0), 0);
}

export function getPaidLovelace(allocations: AdminPayoutAllocation[]): number {
  return allocations
    .filter((allocation) => allocation.status === "paid")
    .reduce((sum, allocation) => sum + Number(allocation.amount_lovelace || 0), 0);
}

export function canOpenPayoutAction(allocation: AdminPayoutAllocation, winnersFinalized: boolean | null | undefined): boolean {
  return Boolean(winnersFinalized) && ["pending", "processing", "failed"].includes(allocation.status);
}

export function getAllocationActionLabel(status: AllocationStatus | string): string {
  if (status === "processing") return "Confirm";
  if (status === "failed") return "Retry";
  return "Pay";
}

export function getPayoutStageLabel(stage: PayoutStage): string {
  switch (stage) {
    case "needs_allocation":
      return "Needs allocation";
    case "ready_to_finalize":
      return "Ready to finalize";
    case "ready_to_pay":
      return "Ready to pay";
    case "awaiting_confirmation":
      return "Awaiting confirmation";
    case "needs_attention":
      return "Needs attention";
    case "completed":
      return "Completed";
  }
}
