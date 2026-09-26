import React from "react";

export type SortIndicatorProps<T = string> = {
  column?: T;
  activeColumn?: T;
  active?: boolean;
  desc?: boolean;
  className?: string;
};

/**
 * Shared Table Column Sort Indicator.
 *
 * Can be used in two ways:
 * 1. `<SortIndicator active={sortCol === "title"} desc={sortDesc} />`
 * 2. `<SortIndicator column="title" activeColumn={sortCol} desc={sortDesc} />`
 */
export function SortIndicator<T = string>({
  column,
  activeColumn,
  active,
  desc = true,
  className = "",
}: SortIndicatorProps<T>) {
  const isSorted =
    active !== undefined
      ? active
      : column !== undefined && activeColumn !== undefined
      ? column === activeColumn
      : false;

  if (!isSorted) return null;

  return (
    <span
      className={className}
      aria-hidden="true"
      style={{ display: "inline-block", marginLeft: 4, fontSize: 11, lineHeight: 1 }}
    >
      {desc ? "↓" : "↑"}
    </span>
  );
}
