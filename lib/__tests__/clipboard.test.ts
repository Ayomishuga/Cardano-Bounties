import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyToClipboard } from "../clipboard";

describe("copyToClipboard", () => {
  const originalWindow = globalThis.window;
  const originalDocument = (globalThis as any).document;
  const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  function setNavigator(mockNav: any) {
    Object.defineProperty(globalThis, "navigator", {
      value: mockNav,
      configurable: true,
      writable: true,
    });
  }

  function setWindow(mockWin: any) {
    Object.defineProperty(globalThis, "window", {
      value: mockWin,
      configurable: true,
      writable: true,
    });
  }

  function setDocument(mockDoc: any) {
    Object.defineProperty(globalThis, "document", {
      value: mockDoc,
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setWindow(originalWindow);
    setDocument(originalDocument);
    if (originalNavigatorDesc) {
      Object.defineProperty(globalThis, "navigator", originalNavigatorDesc);
    }
  });

  it("returns false if text is empty", async () => {
    const result = await copyToClipboard("");
    expect(result).toBe(false);
  });

  it("copies using navigator.clipboard when available", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);

    setWindow({ isSecureContext: true });
    setNavigator({
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const result = await copyToClipboard("addr_test123");
    expect(result).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith("addr_test123");
  });

  it("falls back to document.execCommand when navigator.clipboard fails", async () => {
    const mockTextArea = {
      value: "",
      style: {},
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
    };
    const appendChildMock = vi.fn();
    const removeChildMock = vi.fn();
    const execCommandMock = vi.fn().mockReturnValue(true);

    setWindow({ isSecureContext: true });
    setNavigator({
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Permission denied")),
      },
    });
    setDocument({
      createElement: vi.fn().mockReturnValue(mockTextArea),
      body: {
        appendChild: appendChildMock,
        removeChild: removeChildMock,
      },
      execCommand: execCommandMock,
    });

    const result = await copyToClipboard("fallback_text");
    expect(result).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith("copy");
    expect(appendChildMock).toHaveBeenCalled();
    expect(removeChildMock).toHaveBeenCalled();
  });

  it("falls back to document.execCommand when navigator.clipboard is undefined", async () => {
    const mockTextArea = {
      value: "",
      style: {},
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
    };
    const appendChildMock = vi.fn();
    const removeChildMock = vi.fn();
    const execCommandMock = vi.fn().mockReturnValue(true);

    setWindow({ isSecureContext: true });
    setNavigator({});
    setDocument({
      createElement: vi.fn().mockReturnValue(mockTextArea),
      body: {
        appendChild: appendChildMock,
        removeChild: removeChildMock,
      },
      execCommand: execCommandMock,
    });

    const result = await copyToClipboard("no_clipboard_text");
    expect(result).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith("copy");
  });
});
