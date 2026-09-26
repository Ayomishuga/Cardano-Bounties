"use client";

import { useState, useMemo } from "react";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { TableActionChevron } from "@/components/shared/TableActionChevron";
import styles from "./AdminQueue.module.css";

type Dispute = {
  id: string;
  bounty: string;
  raisedBy: string;
  reason: string;
  status: string;
  openedAt: string;
};

export function AdminDisputesPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); 

  const columns = useMemo<ColumnDef<Dispute>[]>(() => [
    { id: "id", header: "ID", cell: (d) => d.id },
    { id: "bounty", header: "Bounty", cell: (d) => d.bounty },
    { id: "raisedBy", header: "Raised by", cell: (d) => d.raisedBy },
    { id: "reason", header: "Reason", cell: (d) => d.reason },
    { id: "status", header: "Status", cell: (d) => d.status },
    { id: "openedAt", header: "Opened at", cell: (d) => d.openedAt },
    { id: "actions", header: "Actions", align: "right", cell: () => <TableActionChevron /> },
  ], []);

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.tabs} role="tablist">
          {["all", "open", "resolved"].map((f) => (
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
            placeholder="Search disputes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter disputes"
          />
        </div>
      </div>

      <DataTable
        data={[]}
        columns={columns}
        ariaLabel="Disputes"
        emptyState={{
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ),
          title: "No disputes yet",
          description: "Dispute records will appear here after the dispute intake workflow is enabled.",
        }}
      />
    </div>
  );
}
