import { describe, it, expect } from "vitest";
import { calculateItemNavigation } from "../useItemNavigation";

describe("calculateItemNavigation", () => {
  const items = [
    { id: "bounty-1", name: "First" },
    { id: "bounty-2", name: "Second" },
    { id: "bounty-3", name: "Third" },
  ];

  it("handles null or empty selection", () => {
    const res = calculateItemNavigation(items, null);
    expect(res.selectedIndex).toBe(-1);
    expect(res.selectedItem).toBeNull();
    expect(res.canGoPrev).toBe(false);
    expect(res.canGoNext).toBe(false);
    expect(res.prevId).toBeNull();
    expect(res.nextId).toBeNull();
  });

  it("correctly identifies the first item (cannot go prev, can go next)", () => {
    const res = calculateItemNavigation(items, "bounty-1");
    expect(res.selectedIndex).toBe(0);
    expect(res.selectedItem).toEqual({ id: "bounty-1", name: "First" });
    expect(res.canGoPrev).toBe(false);
    expect(res.canGoNext).toBe(true);
    expect(res.prevId).toBeNull();
    expect(res.nextId).toBe("bounty-2");
  });

  it("correctly identifies a middle item (can go prev, can go next)", () => {
    const res = calculateItemNavigation(items, "bounty-2");
    expect(res.selectedIndex).toBe(1);
    expect(res.canGoPrev).toBe(true);
    expect(res.canGoNext).toBe(true);
    expect(res.prevId).toBe("bounty-1");
    expect(res.nextId).toBe("bounty-3");
  });

  it("correctly identifies the last item (can go prev, cannot go next)", () => {
    const res = calculateItemNavigation(items, "bounty-3");
    expect(res.selectedIndex).toBe(2);
    expect(res.canGoPrev).toBe(true);
    expect(res.canGoNext).toBe(false);
    expect(res.prevId).toBe("bounty-2");
    expect(res.nextId).toBeNull();
  });

  it("supports custom getId selector (e.g. key)", () => {
    const keyItems = [
      { key: "k-1", label: "A" },
      { key: "k-2", label: "B" },
    ];
    const res = calculateItemNavigation(keyItems, "k-2", (item) => item.key);
    expect(res.selectedIndex).toBe(1);
    expect(res.canGoPrev).toBe(true);
    expect(res.canGoNext).toBe(false);
    expect(res.prevId).toBe("k-1");
  });

  it("handles non-existent id gracefully", () => {
    const res = calculateItemNavigation(items, "non-existent");
    expect(res.selectedIndex).toBe(-1);
    expect(res.canGoPrev).toBe(false);
    expect(res.canGoNext).toBe(false);
  });
});
