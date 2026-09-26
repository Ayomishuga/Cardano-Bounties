import { PLATFORM_FEE_RATE, LOVELACE_PER_ADA } from "@/lib/bountyContract";

export { LOVELACE_PER_ADA };

export function adaToLovelace(value: string | number) {
  const normalized = String(value).trim();
  const [wholePart, fractionalPart = ""] = normalized.split(".");
  const wholeLovelace = Number(wholePart || "0") * LOVELACE_PER_ADA;
  const fractionalLovelace = Number((fractionalPart + "000000").slice(0, 6));

  return wholeLovelace + fractionalLovelace;
}

export function getEscrowLovelace(rewardAda: string | number) {
  const rewardLovelace = adaToLovelace(rewardAda);
  const feeLovelace = Math.ceil(rewardLovelace * PLATFORM_FEE_RATE);

  return rewardLovelace + feeLovelace;
}

export function lovelaceAsset(quantity: string | number) {
  return {
    unit: "lovelace",
    quantity: String(quantity),
  };
}
