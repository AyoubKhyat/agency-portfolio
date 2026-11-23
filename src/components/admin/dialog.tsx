"use client";

import { useEffect, useId, useRef, type RefObject } from "react";

/**
 * Shared accessible-dialog behaviour for admin pop-ups, drawers and palettes.
 *
 * It adds behaviour only, never styling, so a pop-up keeps its existing markup,
 * animation and theme (including `.os-light` white panels). Spread `dialogProps`
 * on the panel element and put `titleId` on its visible heading (or pass `label`
 * when there is no heading).
 *
 * While open:
 * - the panel is announced as a modal dialog (`role="dialog"`, `aria-modal`);
 * - focus moves into the panel (to `initialFocus`, or the panel itself), unless
 *   something inside it already has focus (e.g. an `autoFocus` field);
 * - Tab and Shift+Tab stay inside the panel (focus that escapes another way,
 *   e.g. out of an embedded iframe, is brought back);
 * - Escape calls `onClose`, unless an inner control already handled Escape
 *   (it called `preventDefault`, e.g. a suggestion list closing itself);
 * - only the top-most open dialog reacts, so a pop-up opened from a drawer
 *   closes on its own without closing the drawer.
 * On close, focus returns to the element that was focused when it opened, or,
 * if that element is gone, to the dialog still open underneath.
 */

type OpenDialog = { token: symbol; panel: RefObject<HTMLElement | null> };
const openStack: OpenDialog[] = [];

// Last two focused elements, so a dialog whose field takes focus on mount
// (`autoFocus`, applied before effects run) still knows where focus came from.
let focusCurrent: HTMLElement | null = null;
let focusPrevious: HTMLElement | null = null;
let focusTracking = false;
function trackFocus() {
  if (focusTracking || typeof document === "undefined") return;
  focusTracking = true;
  focusCurrent = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.addEventListener("focusin", (e) => {
    if (e.target === focusCurrent || !(e.target instanceof HTMLElement)) return;
    focusPrevious = focusCurrent;
    focusCurrent = e.target;
  });
}
// Start tracking as soon as this module loads in the browser (before any dialog opens).
trackFocus();

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(",");

function focusableIn(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden",
  );
}

export type UseDialogOptions = {
  /** Whether the dialog is currently shown. */
  open: boolean;
  onClose: () => void;
  /** Element to focus when the dialog opens. Defaults to the panel itself. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Accessible name when the dialog has no visible heading to point at. */
  label?: string;
  closeOnEscape?: boolean;
};

export function useDialog<T extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
  initialFocus,
  label,
  closeOnEscape = true,
}: UseDialogOptions) {
  const ref = useRef<T>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  const initialFocusRef = useRef(initialFocus);

  useEffect(() => {
    onCloseRef.current = onClose;
    initialFocusRef.current = initialFocus;
  });

  useEffect(() => {
    if (!open) return;
    const token = Symbol("dialog");
    openStack.push({ token, panel: ref });
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // If a field inside the dialog already took focus, return to what had it before.
    const returnTo = active && ref.current?.contains(active) ? focusPrevious : active;

    // The panel may mount a frame later (animated entry), so wait one frame.
    const frame = requestAnimationFrame(() => {
      const panel = ref.current;
      if (!panel || panel.contains(document.activeElement)) return;
      const target = initialFocusRef.current?.current ?? panel;
      target.focus({ preventScroll: true });
    });

    function onKeyDown(e: KeyboardEvent) {
      if (openStack[openStack.length - 1]?.token !== token) return;
      const panel = ref.current;
      if (!panel) return;

      if (e.key === "Escape") {
        if (!closeOnEscape || e.defaultPrevented) return;
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key === "Tab") {
        const items = focusableIn(panel);
        const active = document.activeElement;
        if (items.length === 0) {
          e.preventDefault();
          panel.focus({ preventScroll: true });
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const outside = !panel.contains(active);
        if (e.shiftKey && (outside || active === first || active === panel)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (outside || active === last)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    // Focus can leave without a Tab keydown reaching this document, e.g. tabbing out of
    // an embedded iframe (PDF preview). Bring it back into the top-most dialog.
    function onFocusIn(e: FocusEvent) {
      if (openStack[openStack.length - 1]?.token !== token) return;
      const panel = ref.current;
      if (!panel || !(e.target instanceof Element) || panel.contains(e.target)) return;
      // A dialog opening on top (e.g. its autoFocus field) is not an escape.
      if (e.target.closest('[role="dialog"]')) return;
      (focusableIn(panel)[0] ?? panel).focus({ preventScroll: true });
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      const i = openStack.findIndex((d) => d.token === token);
      if (i >= 0) openStack.splice(i, 1);
      // Restore after the commit, and only if this dialog really closed: an effect re-run
      // (React Strict Mode in development, remounts) re-registers the same panel at once,
      // and restoring then would pull focus off an autoFocus field.
      queueMicrotask(() => {
        if (openStack.some((d) => d.panel === ref)) return;
        if (returnTo && returnTo.isConnected) {
          returnTo.focus({ preventScroll: true });
        } else {
          // The opener is gone (e.g. the drawer re-rendered after a save): keep focus
          // in the dialog that is still open underneath, if any.
          openStack[openStack.length - 1]?.panel.current?.focus({ preventScroll: true });
        }
      });
    };
  }, [open, closeOnEscape]);

  return {
    ref,
    titleId,
    dialogProps: {
      ref,
      role: "dialog" as const,
      "aria-modal": true as const,
      ...(label ? { "aria-label": label } : { "aria-labelledby": titleId }),
      tabIndex: -1,
    },
  };
}
