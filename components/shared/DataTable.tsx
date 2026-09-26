"use client";

import React from "react";
import { SortIndicator } from "./SortIndicator";
import { AdminTableBodyShimmer } from "@/components/dashboard/ShimmerLoaders";
import styles from "./DataTable.module.css";

export type ColumnAlign = "left" | "right" | "center";

export interface ColumnDef<T, K extends string = string> {
  /** Unique identifier for the column */
  id: string;
  /** Header label or React element */
  header: React.ReactNode;
  /** Sort key corresponding to sortCol when this column is sortable */
  sortKey?: K | string;
  /** Quick flag to enable sorting using column id as sortKey */
  sortable?: boolean;
  /** Text alignment in header and cells */
  align?: ColumnAlign;
  /** Optional width for the column */
  width?: string | number;
  /** Custom CSS class for cells in this column */
  className?: string;
  /** Custom CSS class for the th element */
  headerClassName?: string;
  /** Cell rendering function */
  cell: (item: T, index: number) => React.ReactNode;
}

export interface DataTableEmptyState {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export interface DataTableProps<T, K extends string = string> {
  /** Array of data records to display */
  data: T[];
  /** Column definitions */
  columns: ColumnDef<T, any>[];
  /** Custom key extractor for each record (defaults to item.id || item.key || index) */
  keyExtractor?: (item: T, index: number) => string;

  /** Active sort column key */
  sortCol?: K | string;
  /** Sort direction: true for descending, false for ascending */
  sortDesc?: boolean;
  /** Callback fired when a sortable header is clicked */
  onSort?: (colKey: K) => void;

  /** Row click callback */
  onRowClick?: (item: T, index: number) => void;
  /** Custom row renderer override (for complex expandable rows) */
  renderRow?: (item: T, index: number, columns: ColumnDef<T, any>[]) => React.ReactNode;
  /** Custom CSS class getter for each row */
  rowClassName?: (item: T, index: number) => string | undefined;

  /** Loading state indicator */
  isLoading?: boolean;
  /** Number of loading shimmer rows to display (default: 5) */
  loadingRowCount?: number;

  /** Error message to display in the table body */
  error?: string | null;
  /** Retry callback shown in error state */
  onRetry?: () => void;
  /** Custom title for error state */
  errorTitle?: string;

  /** Empty state configuration or custom React element */
  emptyState?: DataTableEmptyState | React.ReactNode;

  /** Accessible label for the table */
  ariaLabel: string;
  /** Custom CSS class for table element */
  className?: string;
  /** Custom CSS class for tableWrap container */
  tableWrapClassName?: string;
}

/**
 * Standardized, accessible, strongly typed DataTable component.
 */
export function DataTable<T, K extends string = string>({
  data,
  columns,
  keyExtractor = (item: any, index) => item?.id ?? item?.key ?? String(index),
  sortCol,
  sortDesc = true,
  onSort,
  onRowClick,
  renderRow,
  rowClassName,
  isLoading = false,
  loadingRowCount = 5,
  error,
  onRetry,
  errorTitle = "Couldn't load data",
  emptyState,
  ariaLabel,
  className = "",
  tableWrapClassName = "",
}: DataTableProps<T, K>) {
  const colCount = columns.length;

  return (
    <div className={`${styles.tableWrap} ${tableWrapClassName}`.trim()}>
      <table className={`${styles.table} ${className}`.trim()} role="grid" aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((col) => {
              const sortKey = col.sortKey ?? (col.sortable ? (col.id as K) : undefined);
              const isSortable = Boolean(sortKey && onSort);
              const isSorted = sortKey !== undefined && sortCol === sortKey;
              const ariaSort = !isSortable
                ? undefined
                : isSorted
                ? sortDesc
                  ? "descending"
                  : "ascending"
                : "none";

              return (
                <th
                  key={col.id}
                  data-sortable={isSortable ? "true" : undefined}
                  onClick={isSortable ? () => onSort!(sortKey!) : undefined}
                  aria-sort={ariaSort}
                  className={col.headerClassName}
                  style={col.width ? { width: col.width } : undefined}
                >
                  <div
                    className={`${styles.thContent} ${
                      col.align === "right"
                        ? styles.right
                        : col.align === "center"
                        ? styles.center
                        : ""
                    }`.trim()}
                  >
                    {col.header}
                    {isSortable && (
                      <SortIndicator
                        column={sortKey}
                        activeColumn={sortCol}
                        desc={sortDesc}
                      />
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <AdminTableBodyShimmer columns={colCount} rows={loadingRowCount} />
          ) : error ? (
            <tr>
              <td colSpan={colCount}>
                <div className={styles.emptyState}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <h3>{errorTitle}</h3>
                  <p>{error}</p>
                  {onRetry && (
                    <button
                      type="button"
                      className={styles.clearFilterBtn}
                      onClick={onRetry}
                    >
                      Retry
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={colCount}>
                {React.isValidElement(emptyState) ? (
                  emptyState
                ) : emptyState && typeof emptyState === "object" && "title" in emptyState ? (
                  <div className={styles.emptyState}>
                    {emptyState.icon || (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                      </svg>
                    )}
                    <h3>{emptyState.title}</h3>
                    <p>{emptyState.description}</p>
                    {emptyState.action}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <h3>No items found</h3>
                    <p>There are no records to display.</p>
                  </div>
                )}
              </td>
            </tr>
          ) : (
            data.map((item, index) => {
              if (renderRow) {
                return renderRow(item, index, columns);
              }

              const rowKey = keyExtractor(item, index);
              const customClassName = rowClassName ? rowClassName(item, index) : "";
              const isClickable = Boolean(onRowClick);

              return (
                <tr
                  key={rowKey}
                  data-clickable={isClickable ? "true" : undefined}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={isClickable ? () => onRowClick!(item, index) : undefined}
                  onKeyDown={
                    isClickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick!(item, index);
                          }
                        }
                      : undefined
                  }
                  className={customClassName}
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === "right"
                        ? styles.right
                        : col.align === "center"
                        ? styles.center
                        : "";
                    const cellClassName = `${alignClass} ${col.className || ""}`.trim();

                    return (
                      <td
                        key={col.id}
                        className={cellClassName || undefined}
                        style={col.width ? { width: col.width } : undefined}
                      >
                        {col.cell(item, index)}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
