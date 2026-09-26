import { useMemo } from "react";

/**
 * Pure calculation helper for item-by-item navigation state.
 */
export function calculateItemNavigation<T>(
  items: T[],
  selectedId: string | null | undefined,
  getId: (item: T) => string = (item: any) => item?.id ?? item?.key ?? ""
) {
  const selectedIndex = selectedId ? items.findIndex((item) => getId(item) === selectedId) : -1;
  const selectedItem: T | null = selectedIndex >= 0 ? items[selectedIndex] : null;
  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex >= 0 && selectedIndex < items.length - 1;
  const prevId = canGoPrev ? getId(items[selectedIndex - 1]) : null;
  const nextId = canGoNext ? getId(items[selectedIndex + 1]) : null;

  return {
    selectedIndex,
    selectedItem,
    canGoPrev,
    canGoNext,
    prevId,
    nextId,
  };
}

/**
 * Hook to manage item-by-item navigation in modal views or detail panes.
 *
 * @param items Array of items being navigated
 * @param selectedId Identifier of the currently selected item (or null)
 * @param onSelect Callback invoked when selecting next/previous item
 * @param getId Optional selector function to extract the identifier from an item
 */
export function useItemNavigation<T>(
  items: T[],
  selectedId: string | null | undefined,
  onSelect: (id: string | null) => void,
  getId: (item: T) => string = (item: any) => item?.id ?? item?.key ?? ""
) {
  const { selectedIndex, selectedItem, canGoPrev, canGoNext, prevId, nextId } = useMemo(
    () => calculateItemNavigation(items, selectedId, getId),
    [items, selectedId, getId]
  );

  const goToPrev = () => {
    if (canGoPrev && prevId) {
      onSelect(prevId);
    }
  };

  const goToNext = () => {
    if (canGoNext && nextId) {
      onSelect(nextId);
    }
  };

  return {
    selectedIndex,
    selectedItem,
    canGoPrev,
    canGoNext,
    goToPrev,
    goToNext,
  };
}
