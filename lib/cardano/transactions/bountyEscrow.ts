import type { BrowserWallet } from "@meshsdk/core";

export type InitiateBountyEscrowInput = {
  wallet: BrowserWallet;
  escrowAddress: string;
  lovelace: string | number;
};

export type RecordOnlyPayoutInput = {
  transactionHash: string;
};

export async function initiateBountyEscrow({
  wallet,
  escrowAddress,
  lovelace,
}: InitiateBountyEscrowInput) {
  const { Transaction } = await import("@meshsdk/core");
  const tx = new Transaction({ initiator: wallet });

  tx.sendLovelace(escrowAddress, String(lovelace));

  const unsignedTx = await tx.build();
  const signedTx = await wallet.signTx(unsignedTx);
  return wallet.submitTx(signedTx);
}

export type ReleaseBountyPayoutInput = {
  wallet: BrowserWallet;
  recipientAddress: string;
  lovelace: string | number;
};

export async function releaseBountyPayout({
  wallet,
  recipientAddress,
  lovelace,
}: ReleaseBountyPayoutInput) {
  const { Transaction } = await import("@meshsdk/core");
  const tx = new Transaction({ initiator: wallet });

  tx.sendLovelace(recipientAddress, String(lovelace));

  const unsignedTx = await tx.build();
  const signedTx = await wallet.signTx(unsignedTx);
  return wallet.submitTx(signedTx);
}

export function recordBountyPayout({ transactionHash }: RecordOnlyPayoutInput) {
  return { transaction_hash: transactionHash };
}

export function recordBountyRefund({ transactionHash }: RecordOnlyPayoutInput) {
  return { transaction_hash: transactionHash };
}

