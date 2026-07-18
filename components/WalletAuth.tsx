'use client'
import { CardanoWallet, useWallet } from '@meshsdk/react';
import { useState } from 'react';

export default function WalletAuth() {
  const { wallet, connected } = useWallet();
  const [loading, setLoading] = useState(false);

  async function startLoginProcess() {
    if (!connected) return;
    setLoading(true);
    try {
      const stakeAddresses = await wallet.getRewardAddresses();
      let stakeAddress = stakeAddresses[0];
      if (stakeAddress && !stakeAddress.startsWith("stake")) {
        const { cst } = await import("@meshsdk/core");
        stakeAddress = cst.deserializeAddress(stakeAddress).toBech32();
      }

      const nonceRes = await fetch(`/api/auth/nonce?address=${stakeAddress}`);
      const { nonce } = await nonceRes.json();

      // 2. Sign nonce using wallet (nonce first, then stake address)
      const signature = await wallet.signData(nonce, stakeAddress);

      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: stakeAddress, signature }),
      });

      const { token } = await verifyRes.json();
      const tokenKey = process.env.NEXT_PUBLIC_STORAGE_TOKEN_KEY!;
      localStorage.setItem(tokenKey, token);
    } catch (err) {
      console.error('Auth failed:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <CardanoWallet
      label={loading ? 'Signing in...' : 'Sign In with Cardano'}
      onConnected={() => startLoginProcess()}
    />
  );
}
