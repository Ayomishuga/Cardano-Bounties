"use client";

import { useMemo } from "react";
import { useAdminSubmissionsWorkspace } from "./useAdminSubmissionsWorkspace";
import { SubmissionDetailModal } from "./SubmissionDetailModal";
import styles from "../AdminQueue.module.css";
import type { Submission } from "@/types/bounty";
import { formatAda, formatRelativeTime } from "@/lib/formatters";
import { getSubmissionBounty } from "@/lib/bountyHelpers";
import { getSubmitterHandle } from "./types";
import { StatusPill } from "@/components/shared/StatusPill";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { TableActionChevron } from "@/components/shared/TableActionChevron";

export function AdminSubmissionsPage() {
  const {
    isLoading,
    error,
    loadDashboard,
    filter,
    setFilter,
    search,
    setSearch,
    sortCol,
    sortDesc,
    handleSort,
    items,
    selectedItem,
    selectedBounty,
    canGoPrev,
    canGoNext,
    goToPrev,
    goToNext,
    handleRowClick,
    handleCloseModal,
    adminNote,
    setAdminNote,
    contextOpen,
    setContextOpen,
    isSubmitting,
    runAction,
    bountyAllocations,
    loadingAllocations,
  } = useAdminSubmissionsWorkspace();

  const columns = useMemo<ColumnDef<Submission>[]>(
    () => [
      {
        id: "submitter",
        header: "Submitter",
        sortable: true,
        cell: (submission) => {
          const handle = getSubmitterHandle(submission);
          return (
            <div className={styles.submitter}>
              <InitialsAvatar name={handle} />
              <span className={styles.handle} title={handle}>
                {handle}
              </span>
            </div>
          );
        },
      },
      {
        id: "bounty",
        header: "Bounty",
        sortable: false,
        cell: (submission) => {
          const bounty = getSubmissionBounty(submission);
          return (
            <span className={styles.bountyTitle} title={bounty?.title}>
              {bounty?.title || "Unknown Bounty"}
            </span>
          );
        },
      },
      {
        id: "amount",
        header: "Amount",
        align: "right",
        sortable: true,
        cell: (submission) => {
          const bounty = getSubmissionBounty(submission);
          return <div className={styles.amount}>{formatAda(bounty?.reward_amount)}</div>;
        },
      },
      {
        id: "status",
        header: "Status",
        sortable: true,
        cell: (submission) => <StatusPill status={submission.status} />,
      },
      {
        id: "submitted",
        header: "Submitted",
        sortable: true,
        cell: (submission) => (
          <span
            className={styles.date}
            title={submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : undefined}
          >
            {formatRelativeTime(submission.submitted_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        sortable: false,
        cell: () => <TableActionChevron ariaLabel="View submission" icon="eye" />,
      },
    ],
    []
  );

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.tabs} role="tablist">
          {["all", "pending", "approved", "rejected"].map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={styles.tab}
              data-active={filter === f}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
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
            placeholder="Search submitter or bounty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter submissions"
          />
        </div>
      </div>

      <DataTable
        data={items}
        columns={columns}
        ariaLabel="Submissions"
        sortCol={sortCol}
        sortDesc={sortDesc}
        onSort={handleSort}
        onRowClick={(submission) => handleRowClick(submission.id)}
        isLoading={isLoading}
        error={error}
        onRetry={() => void loadDashboard()}
        emptyState={{
          title: search || filter !== "all" ? "No matching submissions" : "No submissions yet",
          description: search || filter !== "all" ? "No submissions match your current filters." : "There are no submissions in the queue.",
          action: (search || filter !== "all") ? (
            <button type="button" className={styles.clearFilterBtn} onClick={() => { setFilter("all"); setSearch(""); }}>
              Clear filters
            </button>
          ) : undefined,
        }}
      />

      {selectedItem && (
        <SubmissionDetailModal
          selectedItem={selectedItem}
          selectedBounty={selectedBounty}
          allocations={bountyAllocations}
          isLoadingAllocations={loadingAllocations}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrev={goToPrev}
          onNext={goToNext}
          onClose={handleCloseModal}
          contextOpen={contextOpen}
          setContextOpen={setContextOpen}
          adminNote={adminNote}
          setAdminNote={setAdminNote}
          isSubmitting={isSubmitting}
          onRunAction={runAction}
        />
      )}
    </div>
  );
}

export default AdminSubmissionsPage;
