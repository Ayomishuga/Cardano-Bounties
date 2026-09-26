"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppWallet } from "@/components/wallet/WalletProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { authFetch } from "@/lib/api";
import { formatAda } from "@/lib/formatters";
import type { DashboardResponse, AdminTab } from "./types";
import { adminTabs } from "./types";

export function useDashboardData() {
  const { connected, disconnectWallet, isAuthenticated, role, reauthenticate, stakeAddress } = useAppWallet();
  const toast = useToast();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>(() => {
    if (typeof window === "undefined") return "approval";
    const savedTab = window.localStorage.getItem("admin_dashboard_tab") as AdminTab | null;
    return savedTab && adminTabs.some((tab) => tab.id === savedTab) ? savedTab : "approval";
  });
  const [selectedApprovalId, setSelectedApprovalId] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [selectedBountyId, setSelectedBountyId] = useState("");

  const dashboardRole = role === "admin" ? "admin" : "poster";

  const loadDashboard = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await authFetch(`/api/dashboard/${dashboardRole}`, {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as DashboardResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load dashboard.");
      }

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [dashboardRole, isAuthenticated]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    if (!isAuthenticated) {
      return () => window.clearTimeout(initialTimer);
    }

    const timer = window.setInterval(() => {
      void loadDashboard();
    }, 120_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [isAuthenticated, loadDashboard]);

  function updateAdminTab(tab: AdminTab) {
    setActiveAdminTab(tab);
    window.localStorage.setItem("admin_dashboard_tab", tab);
  }

  async function ensureAuth() {
    if (!connected) throw new Error("Connect your wallet first.");
    if (!isAuthenticated) await reauthenticate();
  }

  async function runAction(id: string, action: () => Promise<Response>, successMessage: string) {
    setActionId(id);
    try {
      await ensureAuth();
      const response = await action();
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Action failed.");
      }

      toast.success("Dashboard updated", successMessage);
      await loadDashboard();
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : "Unable to complete action.");
    } finally {
      setActionId("");
    }
  }

  const metrics = useMemo(() => {
    if (!data) return [];
    if (dashboardRole === "admin") {
      return [
        ["Awaiting bounty review", data.metrics.awaiting_bounty_reviews || 0],
        ["Not live bounties", data.metrics.not_live_bounties || 0],
        ["Refund candidates", data.metrics.refund_candidates || 0],
        ["Queued payout value", formatAda(data.metrics.queued_payout_ada || 0)],
      ];
    }

    return [
      ["My bounties", data.metrics.total_bounties || 0],
      ["Open bounties", data.metrics.open_bounties || 0],
      ["Submission reviews", data.metrics.pending_submission_reviews || 0],
      ["Committed rewards", formatAda(data.metrics.committed_ada || 0)],
    ];
  }, [dashboardRole, data]);

  const shellCounts = useMemo(
    () => ({
      pendingBounties: data?.metrics.awaiting_bounty_reviews || 0,
      submissionReviews: data?.metrics.pending_submissions || 0,
      payouts: data?.metrics.approved_payouts || 0,
      disputes: 0,
      posterReviews: data?.metrics.pending_submission_reviews || 0,
    }),
    [data],
  );

  const navGroups = useMemo(
    () =>
      dashboardRole === "admin"
        ? [
            {
              label: "Overview",
              items: [
                { href: "/dashboard", label: "Overview", count: 0 },
                { href: "/dashboard/settings", label: "Profile Settings", count: 0 },
              ],
            },
            {
              label: "Review",
              items: [
                { href: "/dashboard/payouts", label: "Payouts", count: shellCounts.payouts },
              ],
            },
            {
              label: "Manage",
              items: [
                { href: "/dashboard/bounties", label: "Bounties", count: 0 },
                { href: "/dashboard/posters", label: "Posters", count: 0 },
                { href: "/dashboard/hunters", label: "Hunters", count: 0 },
                { href: "/dashboard/disputes", label: "Disputes", count: shellCounts.disputes },
              ],
            },
            {
              label: "System",
              items: [
                { href: "/dashboard/treasury", label: "Treasury", count: 0 },
              ],
            },
          ]
        : [
            {
              label: "Workspace",
              items: [
                { href: "/dashboard", label: "Overview", count: 0 },
                { href: "/post-bounty", label: "Post bounty", count: 0 },
                { href: "/explore", label: "Explore", count: 0 },
                { href: "/dashboard/reviews", label: "Reviews", count: shellCounts.posterReviews },
                { href: "/dashboard/settings", label: "Profile Settings", count: 0 },
              ],
            },
          ],
    [dashboardRole, shellCounts],
  );

  return {
    connected,
    disconnectWallet,
    isAuthenticated,
    role,
    reauthenticate,
    stakeAddress,
    dashboardRole,
    data,
    isLoading,
    error,
    actionId,
    loadDashboard,
    runAction,
    metrics,
    navGroups,
    activeAdminTab,
    updateAdminTab,
    selectedApprovalId,
    setSelectedApprovalId,
    selectedSubmissionId,
    setSelectedSubmissionId,
    selectedBountyId,
    setSelectedBountyId,
  };
}
