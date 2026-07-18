"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppWallet } from "@/components/wallet/WalletProvider";
import { authFetch } from "@/lib/api";

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_id: string | null;
  read: boolean;
  created_at: string;
};

const POLL_INTERVAL_MS = 60_000;

export function useNotifications() {
  const { isAuthenticated } = useAppWallet();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const res = await authFetch("/api/notifications", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as Notification[];
        setNotifications(data);
      }
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    void fetchNotifications();

    intervalRef.current = setInterval(() => {
      void fetchNotifications();
    }, POLL_INTERVAL_MS);

    function handleVisibilityChange() {
      if (!document.hidden) void fetchNotifications();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await authFetch(`/api/notifications/${id}`, { method: "PATCH" });
    } catch {
      // Optimistic update already applied; silent failure is acceptable
    }
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await authFetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      // Optimistic update already applied
    }
  }

  return { notifications, unreadCount, isLoading, markAsRead, markAllRead, refresh: fetchNotifications };
}
