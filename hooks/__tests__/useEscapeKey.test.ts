import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { attachEscapeListener } from "@/hooks/useEscapeKey";

describe("attachEscapeListener", () => {
  let listeners: Record<string, (e: any) => void> = {};
  const originalWindow = globalThis.window;

  beforeEach(() => {
    listeners = {};
    const mockWindow = {
      addEventListener: vi.fn((event: string, handler: (e: any) => void) => {
        listeners[event] = handler;
      }),
      removeEventListener: vi.fn((event: string) => {
        delete listeners[event];
      }),
    };
    Object.defineProperty(globalThis, "window", {
      value: mockWindow,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });

  it("attaches a keydown listener to window when enabled", () => {
    const onEscape = vi.fn();
    const cleanup = attachEscapeListener(onEscape, true);

    expect(window.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(typeof cleanup).toBe("function");
  });

  it("invokes onEscape when the Escape key is pressed", () => {
    const onEscape = vi.fn();
    attachEscapeListener(onEscape, true);

    expect(listeners["keydown"]).toBeDefined();
    listeners["keydown"]({ key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("does not invoke onEscape for other keys", () => {
    const onEscape = vi.fn();
    attachEscapeListener(onEscape, true);

    listeners["keydown"]({ key: "Enter" });
    listeners["keydown"]({ key: "Tab" });
    listeners["keydown"]({ key: "Space" });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("removes the keydown listener when cleanup is called", () => {
    const onEscape = vi.fn();
    const cleanup = attachEscapeListener(onEscape, true);

    expect(cleanup).toBeDefined();
    cleanup!();
    expect(window.removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("does nothing and returns undefined when isEnabled is false", () => {
    const onEscape = vi.fn();
    const cleanup = attachEscapeListener(onEscape, false);

    expect(window.addEventListener).not.toHaveBeenCalled();
    expect(cleanup).toBeUndefined();
  });

  it("returns undefined safely if window is undefined (SSR)", () => {
    Object.defineProperty(globalThis, "window", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const onEscape = vi.fn();
    const cleanup = attachEscapeListener(onEscape, true);
    expect(cleanup).toBeUndefined();
  });
});
