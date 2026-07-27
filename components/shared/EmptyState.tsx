import React, { ReactNode } from "react";
import styles from "./EmptyState.module.css";

type EmptyStateProps = {
  title: string;
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
};

/**
 * Shared Empty State UI component for tables, lists, and queues.
 */
export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <div className={styles.container}>
      {icon && <div className={styles.iconWrapper}>{icon}</div>}
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
      {action && <div className={styles.actionWrapper}>{action}</div>}
    </div>
  );
}
