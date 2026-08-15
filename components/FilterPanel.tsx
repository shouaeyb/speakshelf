"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useTranslations } from "next-intl";

// Hand-rolled focus containment: a focus-trap dependency would be four
// more kilobytes for one modal that exists only under 721px.
const FOCUSABLE =
  'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface FilterPanelProps {
  /** Closes the panel. Must be stable: the panel's one effect owns the
   *  body scroll lock, and a new identity every render would re-save an
   *  already-locked overflow value as the one to restore. */
  onClose: () => void;
  /** The button that opened the panel; focus returns there on close. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  /** Voices the current filters show, for the closing button. */
  count: number;
  /** Whether any filter is set, so clear-all is worth offering. */
  showClear: boolean;
  onClear: () => void;
  /** The filter fields. The panel owns the chrome, not the controls. */
  children: ReactNode;
}

/** The mobile filter panel: a full-screen boxed dialog holding the
 *  Explorer's select fields. Mounted only while open, so its effect
 *  lifetime is the panel's own. */
export default function FilterPanel({
  onClose,
  triggerRef,
  count,
  showClear,
  onClear,
  children,
}: FilterPanelProps) {
  const t = useTranslations();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const panel = panelRef.current;
    // The trigger is rendered for the panel's whole lifetime, so reading it
    // once here is the same node the cleanup would find later.
    const trigger = triggerRef.current;
    const body = document.body;
    // Saved, not assumed: another surface may already own the value, and
    // the cleanup runs on close and on unmount alike.
    const priorOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    panel?.focus();

    const visible = () =>
      [...(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
        (n) => n.getClientRects().length > 0,
      );

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = visible();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      // Right after open the panel container itself holds focus: from
      // there Tab enters the list at its start and Shift+Tab at its end,
      // never backwards out of the modal.
      if (active === panel || !panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    // The panel is a mobile shape. A window that grows past the desktop
    // breakpoint closes it instead of leaving a modal over the toolbar.
    const wide = window.matchMedia("(min-width: 721px)");
    const onWide = () => {
      if (wide.matches) onClose();
    };
    wide.addEventListener("change", onWide);

    return () => {
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      body.style.overflow = priorOverflow;
      // A close from crossing the desktop breakpoint hides the trigger,
      // and focusing a hidden node is a no-op that drops focus to the
      // body; the search field is on screen on both sides of the
      // breakpoint, so it takes the focus instead. When the whole
      // Explorer unmounts neither node exists and nothing is focused.
      if (trigger && trigger.getClientRects().length > 0) {
        trigger.focus();
      } else {
        document.querySelector<HTMLElement>(".search-input")?.focus();
      }
    };
  }, [onClose, triggerRef]);

  return (
    <div
      ref={panelRef}
      className="fpanel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fpanel-title"
      tabIndex={-1}
    >
      <div className="fpanel-head">
        <h2 className="fpanel-title" id="fpanel-title">
          {t("explorer.filtersTitle")}
        </h2>
        <button
          type="button"
          className="fpanel-close"
          aria-label={t("explorer.dismissAria")}
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="fpanel-body">
        <div className="fpanel-fields">{children}</div>
      </div>
      <div className="fpanel-foot">
        {showClear && (
          <button type="button" className="clear-btn" onClick={onClear}>
            {t("explorer.clear")}
          </button>
        )}
        <button type="button" className="fpanel-apply" onClick={onClose}>
          {t("explorer.showResults", { count })}
        </button>
      </div>
    </div>
  );
}
