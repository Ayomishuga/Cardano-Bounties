"use client";

import { useEffect, useRef } from "react";

/**
 * Attaches a window "keydown" listener that calls `onEscape` when the Escape key is pressed.
 * Returns the teardown function that removes the event listener, or undefined if not enabled.
 */
export function attachEscapeListener(
  onEscape: () => void,
  isEnabled: boolean = true,
): (() => void) | undefined {
  if (!isEnabled || typeof window === "undefined") return undefined;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onEscape();
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}

/**
 * Attaches a window "keydown" listener that calls `onEscape` when the Escape key is pressed.
 * Automatically detaches on unmount or when `isEnabled` is false.
 * Uses a ref for the handler to avoid re-attaching the listener on every render when handler identity changes.
 *
 * @param onEscape - Callback function to invoke when Escape is pressed.
 * @param isEnabled - Optional boolean flag to enable or disable the listener (default: true).
 */
export function useEscapeKey(onEscape: () => void, isEnabled: boolean = true): void {
  const handlerRef = useRef(onEscape);

  useEffect(() => {
    handlerRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    return attachEscapeListener(() => handlerRef.current(), isEnabled);
  }, [isEnabled]);
}
