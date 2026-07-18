"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Notification } from "@/hooks/useNotifications";
import styles from "./NotificationPanel.module.css";

const typeIcons: Record<string, string> = {
  submission_approved: "✅",
  submission_rejected: "❌",
  bounty_approved: "🟢",
  bounty_rejected: "🔴",
  new_submission: "📬",
  payment_released: "💸",
};

function formatRelativeTime(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type Props = {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllRead: () => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function NotificationPanel({
  notifications,
  unreadCount,
  isOpen,
  onClose,
  onMarkAsRead,
  onMarkAllRead,
  selectedId,
  onSelect,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const selected = notifications.find((n) => n.id === selectedId) || null;

  // Only portal-render client-side (avoid SSR mismatch)
  useEffect(() => { setMounted(true); }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  function handleItemClick(notification: Notification) {
    if (!notification.read) onMarkAsRead(notification.id);
    onSelect(notification.id === selectedId ? null : notification.id);
  }

  const content = (
    <>
      <div className={styles.backdrop} aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-label="Notifications"
        aria-modal="true"
      >
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <h2>Notifications</h2>
            {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount}</span>}
          </div>
          <div className={styles.panelActions}>
            {unreadCount > 0 && (
              <button type="button" className={styles.markAllBtn} onClick={onMarkAllRead}>
                Mark all read
              </button>
            )}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close notifications">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.panelBody}>
          {selected ? (
            <div className={styles.detailView}>
              <button type="button" className={styles.backBtn} onClick={() => onSelect(null)}>
                ← Back to notifications
              </button>
              <div className={styles.detailIcon}>{typeIcons[selected.type] || "🔔"}</div>
              <h3 className={styles.detailTitle}>{selected.title}</h3>
              <div className={styles.detailMeta}>
                <span className={styles.detailTime}>{formatRelativeTime(selected.created_at)}</span>
              </div>
              <p className={styles.detailMessage}>{selected.message}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🔔</span>
              <p>No notifications yet.</p>
              <small>You will be notified about bounty and submission activity here.</small>
            </div>
          ) : (
            <ul className={styles.notifList} role="list">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`${styles.notifItem} ${!n.read ? styles.unread : ""}`}
                    onClick={() => handleItemClick(n)}
                    aria-pressed={selectedId === n.id}
                  >
                    <span className={styles.notifIcon}>{typeIcons[n.type] || "🔔"}</span>
                    <div className={styles.notifContent}>
                      <span className={styles.notifTitle}>{n.title}</span>
                      <span className={styles.notifMessage}>{n.message}</span>
                      <span className={styles.notifTime}>{formatRelativeTime(n.created_at)}</span>
                    </div>
                    {!n.read && <span className={styles.unreadDot} aria-label="Unread" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
