"use client";

import dynamic from "next/dynamic";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { ToastProvider } from "@/components/toast/ToastProvider";

const MeshProvider = dynamic(
  () => import("@meshsdk/react").then((mod) => mod.MeshProvider),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MeshProvider>
      <ThemeProvider>
        <WalletProvider>
          <ToastProvider>{children}</ToastProvider>
        </WalletProvider>
      </ThemeProvider>
    </MeshProvider>
  );
}
