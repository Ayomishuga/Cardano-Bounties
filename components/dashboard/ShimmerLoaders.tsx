import React from "react";
import styles from "./ShimmerLoaders.module.css";

export function Shimmer({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`${styles.shimmerWrapper} ${className}`} style={style} />;
}

export function MetricGridShimmer() {
  return (
    <section className={styles.metricGrid} aria-hidden="true" aria-label="Loading metrics">
      {Array.from({ length: 4 }).map((_, i) => (
        <article className={styles.metricCard} key={i}>
          <Shimmer className={styles.metricLabel} />
          <Shimmer className={styles.metricValue} />
        </article>
      ))}
    </section>
  );
}

export function WorkspaceQueueShimmer() {
  return (
    <div className={styles.panel} aria-hidden="true">
      <div className={styles.panelHeader}>
        <div>
          <Shimmer className={styles.headerSubtitle} />
          <Shimmer className={styles.headerTitle} />
        </div>
        <Shimmer className={styles.headerBtn} />
      </div>

      <div className={styles.queueList}>
        {Array.from({ length: 3 }).map((_, i) => (
          <article className={styles.queueItem} key={i}>
            <div>
              <Shimmer className={styles.itemTitle} />
              <Shimmer className={styles.itemDesc} />
            </div>
            <Shimmer className={styles.itemBadge} />
            <Shimmer className={styles.itemAction} />
          </article>
        ))}
      </div>
    </div>
  );
}

export function HealthPanelShimmer() {
  return (
    <aside className={styles.healthPanel} aria-hidden="true">
      <Shimmer className={styles.healthTitle} />
      <Shimmer className={styles.healthMetric} />
      <Shimmer className={styles.healthBar} />
      <Shimmer className={styles.healthDesc} />
    </aside>
  );
}

export function AdminTableShimmer({ columns = 6, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <div className={styles.tableWrap} aria-hidden="true">
      <table className={styles.table}>
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <Shimmer className={styles.thContent} style={{ width: i === 0 ? "80px" : i === columns - 1 ? "40px" : "100%" }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rIndex) => (
            <tr key={rIndex}>
              {Array.from({ length: columns }).map((_, cIndex) => (
                <td key={cIndex}>
                  <Shimmer
                    className={styles.tdCell}
                    style={{
                      width: cIndex === 0 ? "140px" : cIndex === columns - 1 ? "40px" : Math.random() > 0.5 ? "80%" : "50%",
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminTableBodyShimmer({ columns = 6, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIndex) => (
        <tr key={rIndex} aria-hidden="true">
          {Array.from({ length: columns }).map((_, cIndex) => (
            <td key={cIndex}>
              <Shimmer
                className={styles.tdCell}
                style={{
                  width: cIndex === 0 ? "140px" : cIndex === columns - 1 ? "40px" : Math.random() > 0.5 ? "80%" : "50%",
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function AdminOperationsShimmer() {
  return (
    <>
      <section className={styles.operationGrid} aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <article className={styles.operationCard} key={i}>
            <div>
              <Shimmer style={{ height: "12px", width: "120px", borderRadius: "4px", marginBottom: "16px" }} />
              <Shimmer style={{ height: "42px", width: "60px", borderRadius: "8px", marginBottom: "12px" }} />
              <Shimmer style={{ height: "36px", width: "100%", borderRadius: "4px" }} />
            </div>
            <Shimmer style={{ height: "38px", width: "140px", borderRadius: "4px", marginTop: "auto" }} />
          </article>
        ))}
      </section>

      <section className={styles.managementPanel} aria-hidden="true">
        <div className={styles.panelHeader}>
          <div>
            <Shimmer style={{ height: "12px", width: "100px", borderRadius: "4px", marginBottom: "8px" }} />
            <Shimmer style={{ height: "24px", width: "180px", borderRadius: "6px", marginBottom: "8px" }} />
            <Shimmer style={{ height: "14px", width: "400px", borderRadius: "4px" }} />
          </div>
          <Shimmer style={{ height: "38px", width: "120px", borderRadius: "4px" }} />
        </div>
        <div className={styles.operationSummaryGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ border: "1px solid var(--line-soft)", borderRadius: "12px", padding: "16px", background: "#fbfcfe" }}>
              <Shimmer style={{ height: "12px", width: "100px", borderRadius: "4px", marginBottom: "10px" }} />
              <Shimmer style={{ height: "22px", width: "60px", borderRadius: "6px" }} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
