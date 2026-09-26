import { describe, it, expect } from "vitest";
import {
  adaToLovelace,
  getEscrowLovelace,
  lovelaceAsset,
  LOVELACE_PER_ADA,
} from "@/lib/cardano/amounts";

// ---------------------------------------------------------------------------
// adaToLovelace
// ---------------------------------------------------------------------------
describe("adaToLovelace", () => {
  it("converts whole ADA to lovelace", () => {
    expect(adaToLovelace("5")).toBe(5_000_000);
  });

  it("converts 100 ADA to lovelace", () => {
    expect(adaToLovelace(100)).toBe(100_000_000);
  });

  it("converts decimal ADA to lovelace", () => {
    expect(adaToLovelace("1.5")).toBe(1_500_000);
  });

  it("handles smallest unit (0.000001 ADA = 1 lovelace)", () => {
    expect(adaToLovelace("0.000001")).toBe(1);
  });

  it("handles string input with decimal", () => {
    expect(adaToLovelace("10.25")).toBe(10_250_000);
  });

  it("converts zero correctly", () => {
    expect(adaToLovelace("0")).toBe(0);
  });

  it("handles numeric input", () => {
    expect(adaToLovelace(250)).toBe(250_000_000);
  });
});

// ---------------------------------------------------------------------------
// getEscrowLovelace
// ---------------------------------------------------------------------------
describe("getEscrowLovelace", () => {
  it("adds 10% platform fee to reward", () => {
    // 100 ADA = 100_000_000 lovelace, 10% fee = 10_000_000
    expect(getEscrowLovelace(100)).toBe(110_000_000);
  });

  it("handles small amounts with fee rounding up", () => {
    // 1 ADA = 1_000_000 lovelace, 10% = 100_000
    expect(getEscrowLovelace(1)).toBe(1_100_000);
  });

  it("uses Math.ceil for fee so the platform is never underpaid", () => {
    // 3 ADA = 3_000_000, 10% = 300_000
    expect(getEscrowLovelace(3)).toBe(3_300_000);
  });
});

// ---------------------------------------------------------------------------
// lovelaceAsset
// ---------------------------------------------------------------------------
describe("lovelaceAsset", () => {
  it("returns object with unit=lovelace and stringified quantity", () => {
    expect(lovelaceAsset(5_000_000)).toEqual({
      unit: "lovelace",
      quantity: "5000000",
    });
  });

  it("handles string input", () => {
    expect(lovelaceAsset("1000000")).toEqual({
      unit: "lovelace",
      quantity: "1000000",
    });
  });
});

// ---------------------------------------------------------------------------
// LOVELACE_PER_ADA constant
// ---------------------------------------------------------------------------
describe("LOVELACE_PER_ADA", () => {
  it("is 1,000,000", () => {
    expect(LOVELACE_PER_ADA).toBe(1_000_000);
  });
});
