"use client";

import { useMemo } from "react";
import styles from "../AdminQueue.module.css";
import { usePayoutsWorkspace } from "./usePayoutsWorkspace";
import { BountyPayoutRow } from "./BountyPayoutRow";
import { PaymentModal } from "./PaymentModal";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import type { Bounty } from "./types";

export function AdminPayoutsPage() {
  const {
    isLoading,
    error,
    search,
    setSearch,
    filter,
    setFilter,
    sortCol,
    sortDesc,
    handleSort,
    payoutBounties,
    loadData,
    // Expanded state
    expandedBountyIds,
    toggleExpand,
    // Allocation drafts & edits
    allocationDrafts,
    setAllocationDrafts,
    getDraftKey,
    editingAllocationId,
    setEditingAllocationId,
    editDraft,
    setEditDraft,
    saveEditAllocation,
    // Actions & loading states
    reviewingBountyId,
    startReview,
    allocatingSubmissionId,
    createAllocation,
    finalizingBountyId,
    finalizeWinners,
    cancellingAllocationId,
    cancelAllocation,
    getAllocationDefaults,
    // Payment Modal state & actions
    selectedAlloc,
    selectedBounty,
    txHash,
    setTxHash,
    resolvingAddress,
    resolvedAddress,
    resolvedSource,
    resolveError,
    isSubmitting,
    isExecutingOnChain,
    openReleaseModal,
    closeModal,
    recordManualPayout,
    executeOnChainPayout,
  } = usePayoutsWorkspace();

  const columns = useMemo<ColumnDef<Bounty>[]>(
    () => [
      {
        id: "title",
        header: "Bounty",
        sortable: true,
        cell: () => null,
      },
      {
        id: "payout_type",
        header: "Payout type",
        sortable: false,
        cell: () => null,
      },
      {
        id: "reward_pool",
        header: "Reward pool",
        sortable: false,
        cell: () => null,
      },
      {
        id: "status",
        header: "Bounty status",
        align: "right",
        sortable: true,
        cell: () => null,
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        sortable: false,
        cell: () => null,
      },
    ],
    []
  );

  return (
    <div className={styles.container}>
      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.tabs} role="tablist">
          {([
            { value: "all",              label: "All" },
            { value: "needs_allocation", label: "Needs allocation" },
            { value: "ready_to_pay",     label: "Ready to pay" },
            { value: "partially_paid",   label: "Partially paid" },
            { value: "completed",        label: "Completed" },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              className={styles.tab}
              data-active={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.search}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search bounty title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter bounties"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={payoutBounties}
        columns={columns}
        ariaLabel="Bounty Payouts"
        sortCol={sortCol}
        sortDesc={sortDesc}
        onSort={handleSort}
        isLoading={isLoading}
        error={error}
        onRetry={() => void loadData()}
        emptyState={{
          title: search || filter !== "all" ? "No matching bounties" : "No payouts queued",
          description: search || filter !== "all"
            ? "No bounties match your current filters."
            : "Bounties move here once they are in review, have approved submissions ready for review, or are awaiting payout.",
          action: (search || filter !== "all") ? (
            <button type="button" className={styles.clearFilterBtn} onClick={() => { setFilter("all"); setSearch(""); }}>
              Clear filters
            </button>
          ) : undefined,
        }}
        renderRow={(bounty) => (
          <BountyPayoutRow
            key={bounty.id}
            bounty={bounty}
            isExpanded={expandedBountyIds.has(bounty.id)}
            toggleExpand={toggleExpand}
            reviewingBountyId={reviewingBountyId}
            startReview={startReview}
            editingAllocationId={editingAllocationId}
            setEditingAllocationId={setEditingAllocationId}
            editDraft={editDraft}
            setEditDraft={setEditDraft}
            saveEditAllocation={saveEditAllocation}
            cancellingAllocationId={cancellingAllocationId}
            cancelAllocation={cancelAllocation}
            openReleaseModal={openReleaseModal}
            getAllocationDefaults={getAllocationDefaults}
            getDraftKey={getDraftKey}
            allocationDrafts={allocationDrafts}
            setAllocationDrafts={setAllocationDrafts}
            allocatingSubmissionId={allocatingSubmissionId}
            createAllocation={createAllocation}
            finalizingBountyId={finalizingBountyId}
            finalizeWinners={finalizeWinners}
          />
        )}
      />

      {/* Release Payment Modal */}
      {selectedAlloc && selectedBounty && (
        <PaymentModal
          selectedAlloc={selectedAlloc}
          selectedBounty={selectedBounty}
          txHash={txHash}
          setTxHash={setTxHash}
          resolvingAddress={resolvingAddress}
          resolvedAddress={resolvedAddress}
          resolvedSource={resolvedSource}
          resolveError={resolveError}
          isSubmitting={isSubmitting}
          isExecutingOnChain={isExecutingOnChain}
          closeModal={closeModal}
          recordManualPayout={recordManualPayout}
          executeOnChainPayout={executeOnChainPayout}
        />
      )}
    </div>
  );
}

export default AdminPayoutsPage;

