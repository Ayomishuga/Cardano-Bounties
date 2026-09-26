import { describe, it, expect, vi } from "vitest";
import React from "react";
import { StatusPill, resolveStatusKey } from "../StatusPill";
import { InitialsAvatar } from "../InitialsAvatar";
import { ModalCloseButton } from "../ModalCloseButton";
import { ModalNavControls } from "../ModalNavControls";
import { SortIndicator } from "../SortIndicator";

describe("resolveStatusKey", () => {
  it("resolves null/undefined to unknown", () => {
    expect(resolveStatusKey(null)).toBe("unknown");
    expect(resolveStatusKey(undefined)).toBe("unknown");
    expect(resolveStatusKey("")).toBe("unknown");
  });

  it("maps open and committed to approved", () => {
    expect(resolveStatusKey("open")).toBe("approved");
    expect(resolveStatusKey("OPEN")).toBe("approved");
    expect(resolveStatusKey("Committed")).toBe("approved");
  });

  it("maps needs payment to warning and needs review to danger", () => {
    expect(resolveStatusKey("Needs payment")).toBe("warning");
    expect(resolveStatusKey("needs_payment")).toBe("warning");
    expect(resolveStatusKey("Needs review")).toBe("danger");
    expect(resolveStatusKey("needs_review")).toBe("danger");
  });

  it("replaces spaces with underscores and normalizes lowercase", () => {
    expect(resolveStatusKey("Pending Escrow")).toBe("pending_escrow");
    expect(resolveStatusKey("In Review")).toBe("in_review");
    expect(resolveStatusKey("changes_requested")).toBe("changes_requested");
  });
});

describe("StatusPill component", () => {
  it("renders with normalized status and correct data-status", () => {
    const el = StatusPill({ status: "open" });
    expect(el.type).toBe("span");
    expect(el.props["data-status"]).toBe("approved");
    expect(el.props.children).toBe("Open");
  });

  it("accepts a custom label override", () => {
    const el = StatusPill({ status: "pending", label: "Ready" });
    expect(el.props["data-status"]).toBe("pending");
    expect(el.props.children).toBe("Ready");
  });

  it("handles unknown or empty status gracefully", () => {
    const el = StatusPill({ status: null });
    expect(el.props["data-status"]).toBe("unknown");
    expect(el.props.children).toBe("Unknown");
  });

  it("merges custom className and style props", () => {
    const customStyle = { marginRight: 8 };
    const el = StatusPill({ status: "approved", className: "extraClass", style: customStyle });
    expect(el.props.className).toContain("extraClass");
    expect(el.props.style).toEqual(customStyle);
  });
});

describe("InitialsAvatar component", () => {
  it("renders initials correctly with aria-hidden", () => {
    const el = InitialsAvatar({ name: "John Doe" });
    expect(el.type).toBe("div");
    expect(el.props["aria-hidden"]).toBe("true");
    expect(el.props.children).toBe("JO");
  });

  it("renders fallback initials for null/empty names", () => {
    const el = InitialsAvatar({ name: null });
    expect(el.props.children).toBe("?");
  });

  it("supports different sizes and classes", () => {
    const elSm = InitialsAvatar({ name: "Alice", size: "sm", className: "custom" });
    expect(elSm.props.className).toContain("custom");
    expect(elSm.props.children).toBe("AL");

    const elLg = InitialsAvatar({ name: "Bob", size: "lg" });
    expect(elLg.props.children).toBe("BO");
  });
});

describe("ModalCloseButton component", () => {
  it("renders a button with correct aria-label and click handler", () => {
    const onClose = vi.fn();
    const el = ModalCloseButton({ onClose });
    expect(el.type).toBe("button");
    expect(el.props["aria-label"]).toBe("Close modal");
    expect(el.props.onClick).toBe(onClose);
  });

  it("supports custom label, size, and className", () => {
    const onClose = vi.fn();
    const el = ModalCloseButton({ onClose, label: "Dismiss dialog", size: 24, className: "btn-custom" });
    expect(el.props["aria-label"]).toBe("Dismiss dialog");
    expect(el.props.className).toContain("btn-custom");
    const svgChild = el.props.children;
    expect(svgChild.props.width).toBe(24);
    expect(svgChild.props.height).toBe(24);
  });
});

describe("ModalNavControls component", () => {
  it("renders previous and next buttons with disabled states and labels", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const el = ModalNavControls({
      canGoPrev: false,
      canGoNext: true,
      onPrev,
      onNext,
      itemLabel: "bounty",
    });

    expect(el.type).toBe("div");
    const [prevBtn, nextBtn] = el.props.children;
    expect(prevBtn.props.disabled).toBe(true);
    expect(prevBtn.props["aria-label"]).toBe("Previous bounty");
    expect(nextBtn.props.disabled).toBe(false);
    expect(nextBtn.props["aria-label"]).toBe("Next bounty");
  });
});

describe("SortIndicator component", () => {
  it("returns null when inactive", () => {
    const el1 = SortIndicator({ active: false });
    expect(el1).toBeNull();

    const el2 = SortIndicator({ column: "title", activeColumn: "date" });
    expect(el2).toBeNull();
  });

  it("renders descending indicator when active and desc is true", () => {
    const el = SortIndicator({ active: true, desc: true });
    expect(el).not.toBeNull();
    expect(el!.type).toBe("span");
    expect(el!.props.children).toBe("↓");
  });

  it("renders ascending indicator when active and desc is false", () => {
    const el = SortIndicator({ column: "amount", activeColumn: "amount", desc: false });
    expect(el).not.toBeNull();
    expect(el!.type).toBe("span");
    expect(el!.props.children).toBe("↑");
  });
});

