"use client";

import { useAppWallet } from "@/components/wallet/WalletProvider";
import { AdminOperationsPage } from "./AdminOperationsPage";
import { PosterOverviewPage } from "./PosterOverviewPage";

export function DashboardHomePage() {
  const { role } = useAppWallet();

  if (role === "admin") {
    return <AdminOperationsPage />;
  }

  return <PosterOverviewPage />;
}
