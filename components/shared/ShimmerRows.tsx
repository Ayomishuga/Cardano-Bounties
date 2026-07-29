import React from "react";
import styles from "./ShimmerRows.module.css";

type ShimmerRowsProps = {
  count?: number;
  height?: string | number;
  className?: string;
};

/**
 * Reusable animated shimmer skeleton loader for table rows and list items.
 */
export function ShimmerRows({ count = 3, height = 48, className = "" }: ShimmerRowsProps) {
  return (
    <div className={`${styles.container} ${className}`} aria-label="Loading content...">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={styles.row}
          style={{ height: typeof height === "number" ? `${height}px` : height }}
        />
      ))}
    </div>
  );
}
