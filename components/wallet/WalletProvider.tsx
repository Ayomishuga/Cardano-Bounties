"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { BrowserWallet } from "@meshsdk/core";
import type { Wallet } from "@meshsdk/common";

type WalletContextValue = {
  wallet: BrowserWallet | null;
  wallets: Wallet[];
  walletId: string;
  walletName: string;
  address: string;
  stakeAddress: string;
  connected: boolean;
  connecting: boolean;
  signingIn: boolean;
  isAuthenticated: boolean;
  token: string | null;
  role: string | null;
  error: string;
  loadWallets: () => Promise<void>;
  connectWallet: (walletId: string) => Promise<void>;
  disconnectWallet: () => void;
  reauthenticate: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);
const STORAGE_WALLET_KEY = process.env.NEXT_PUBLIC_STORAGE_WALLET_KEY!;
const STORAGE_TOKEN_KEY = process.env.NEXT_PUBLIC_STORAGE_TOKEN_KEY!;

async function toBech32Address(address: string) {
  if (!address) return "";
  if (address.startsWith("addr") || address.startsWith("stake")) {
    return address;
  }
  try {
    const { cst } = await import("@meshsdk/core");
    return cst.deserializeAddress(address).toBech32();
  } catch (err) {
    console.error("Failed to convert address to Bech32:", err);
    return address;
  }
}

async function resolveWalletAddress(wallet: BrowserWallet) {
  const usedAddresses = await wallet.getUsedAddresses();
  const changeAddress = await wallet.getChangeAddress();
  const rawAddress = usedAddresses[0] || changeAddress || "";
  return toBech32Address(rawAddress);
}

async function resolveStakeAddress(wallet: BrowserWallet) {
  const stakeAddresses = await wallet.getRewardAddresses();
  const rawAddress = stakeAddresses[0] || "";
  return toBech32Address(rawAddress);
}

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return true;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

type DecodedToken = {
  userId: string;
  address: string;
  role: string;
  exp: number;
};

function decodeToken(token: string | null): DecodedToken | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1])) as DecodedToken;
  } catch {
    return null;
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<BrowserWallet | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState("");
  const [walletName, setWalletName] = useState("");
  const [address, setAddress] = useState("");
  const [stakeAddress, setStakeAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadWallets = useCallback(async () => {
    setError("");
    try {
      const { BrowserWallet } = await import("@meshsdk/core");
      setWallets(await BrowserWallet.getAvailableWallets());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to detect wallet extensions.");
    }
  }, []);

  const authenticateWallet = useCallback(async (activeWallet: BrowserWallet, activeStakeAddress: string) => {
    setSigningIn(true);
    setError("");
    try {
      // 1. Get nonce
      const nonceRes = await fetch(`/api/auth/nonce?address=${activeStakeAddress}`);
      if (!nonceRes.ok) {
        const nonceData = (await nonceRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(nonceData?.error || "Failed to fetch login challenge from server.");
      }
      const { nonce } = await nonceRes.json();

      // 2. Sign nonce using wallet (stake address, nonce payload)
      // 2. Sign nonce using wallet (nonce first, then stake address)
      const signature = await activeWallet.signData(nonce, activeStakeAddress);

      // 3. Post to verify route
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: activeStakeAddress, signature }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Authentication signature verification failed.");
      }

      // 4. Save and set JWT
      const jwtToken = verifyData.token;
      window.localStorage.setItem(STORAGE_TOKEN_KEY, jwtToken);
      setToken(jwtToken);

      const decoded = decodeToken(jwtToken);
      setRole(decoded?.role || "contributor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication signature failed.");
      window.localStorage.removeItem(STORAGE_TOKEN_KEY);
      setToken(null);
      setRole(null);
      throw err;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const connectWallet = useCallback(async (nextWalletId: string) => {
    setConnecting(true);
    setError("");
    try {
      const { BrowserWallet } = await import("@meshsdk/core");
      const connectedWallet = await BrowserWallet.enable(nextWalletId);
      const nextAddress = await resolveWalletAddress(connectedWallet);
      const nextStakeAddress = await resolveStakeAddress(connectedWallet);
      
      if (!nextStakeAddress) {
        throw new Error("Unable to retrieve your wallet's stake key. Please verify your wallet configuration.");
      }

      const availableWallets = wallets.length > 0 ? wallets : await BrowserWallet.getAvailableWallets();
      const availableWallet = availableWallets.find((item) => item.id === nextWalletId);

      setWallet(connectedWallet);
      setWallets(availableWallets);
      setWalletId(nextWalletId);
      setWalletName(availableWallet?.name || nextWalletId);
      setAddress(nextAddress);
      setStakeAddress(nextStakeAddress);
      window.localStorage.setItem(STORAGE_WALLET_KEY, nextWalletId);

      // Automatically authenticate on initial connection
      await authenticateWallet(connectedWallet, nextStakeAddress);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect wallet.");
      throw err;
    } finally {
      setConnecting(false);
    }
  }, [wallets, authenticateWallet]);

  const disconnectWallet = useCallback(() => {
    setWallet(null);
    setWalletId("");
    setWalletName("");
    setAddress("");
    setStakeAddress("");
    setToken(null);
    setRole(null);
    setError("");
    window.localStorage.removeItem(STORAGE_WALLET_KEY);
    window.localStorage.removeItem(STORAGE_TOKEN_KEY);
  }, []);

  const reauthenticate = useCallback(async () => {
    if (!wallet || !stakeAddress) {
      throw new Error("No connected wallet found to authenticate.");
    }
    await authenticateWallet(wallet, stakeAddress);
  }, [wallet, stakeAddress, authenticateWallet]);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const storedWalletId = window.localStorage.getItem(STORAGE_WALLET_KEY);
      const storedToken = window.localStorage.getItem(STORAGE_TOKEN_KEY);

      if (!storedWalletId) return;

      try {
        setConnecting(true);
        const { BrowserWallet } = await import("@meshsdk/core");
        const availableWallets = await BrowserWallet.getAvailableWallets();
        const availableWallet = availableWallets.find((item) => item.id === storedWalletId);

        if (!availableWallet) {
          window.localStorage.removeItem(STORAGE_WALLET_KEY);
          window.localStorage.removeItem(STORAGE_TOKEN_KEY);
          return;
        }

        const restoredWallet = await BrowserWallet.enable(storedWalletId);
        const restoredAddress = await resolveWalletAddress(restoredWallet);
        const restoredStake = await resolveStakeAddress(restoredWallet);

        if (!isMounted) return;

        setWallet(restoredWallet);
        setWallets(availableWallets);
        setWalletId(storedWalletId);
        setWalletName(availableWallet.name || storedWalletId);
        setAddress(restoredAddress);
        setStakeAddress(restoredStake);

        if (storedToken && !isTokenExpired(storedToken)) {
          setToken(storedToken);
          const decoded = decodeToken(storedToken);
          setRole(decoded?.role || "contributor");
        } else {
          // Token expired or missing, require user signature re-authentication
          window.localStorage.removeItem(STORAGE_TOKEN_KEY);
          setToken(null);
          setRole(null);
        }
      } catch {
        if (isMounted) {
          window.localStorage.removeItem(STORAGE_WALLET_KEY);
          window.localStorage.removeItem(STORAGE_TOKEN_KEY);
          setError("Unable to restore your previous wallet session.");
        }
      } finally {
        if (isMounted) setConnecting(false);
      }
    }

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const isAuthenticated = useMemo(() => {
    return Boolean(token && !isTokenExpired(token));
  }, [token]);

  const value = useMemo(
    () => ({
      wallet,
      wallets,
      walletId,
      walletName,
      address,
      stakeAddress,
      connected: Boolean(wallet && address),
      connecting,
      signingIn,
      isAuthenticated,
      token,
      role,
      error,
      loadWallets,
      connectWallet,
      disconnectWallet,
      reauthenticate,
    }),
    [
      wallet,
      wallets,
      walletId,
      walletName,
      address,
      stakeAddress,
      connecting,
      signingIn,
      isAuthenticated,
      token,
      role,
      error,
      loadWallets,
      connectWallet,
      disconnectWallet,
      reauthenticate,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useAppWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useAppWallet must be used inside WalletProvider");
  }
  return context;
}
