"use client";

import { useAppWallet } from "@/components/wallet/WalletProvider";
import { AdminBountiesPage } from "./AdminBountiesPage";
import { PosterBountiesPage } from "./PosterBountiesPage";

export function DashboardBountiesPage() {
  const { role } = useAppWallet();

  if (role === "admin") {
    return <AdminBountiesPage />;
  }

  return <PosterBountiesPage />;
}
