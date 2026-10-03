import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useBodyScrollLock } from "./useBodyScrollLock";

const CLOSE_DURATION = 180;

type SheetStyle = CSSProperties & {
  "--sheet-drag-y"?: string;
  "--sheet-viewport-height"?: string;
  "--sheet-viewport-top"?: string;
};

function currentViewport(layoutHeight: number) {
  const visualViewport = window.visualViewport;
  const visualHeight = visualViewport?.height ?? layoutHeight;
  const keyboardOpen = !!visualViewport && visualHeight < layoutHeight - 80;

  return {
    height: keyboardOpen
      ? String(visualHeight) + "px"
      : "var(--app-viewport-height, 100dvh)",
    top: keyboardOpen ? String(visualViewport?.offsetTop ?? 0) + "px" : "0px",
    keyboardOpen,
  };
}

export function BottomSheet({
  title,
  closing,
  className,
  backdropClassName,
  onClose,
  children,
}: {
  title: string;
  closing?: boolean;
  className?: string;
  backdropClassName?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const backdrop = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const dragStartedAt = useRef(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Capture before focus/keyboard events: iOS can temporarily report the same
  // reduced innerHeight and visualViewport.height during keyboard opening.
  const [layoutHeight] = useState(
    () => document.documentElement.clientHeight || window.innerHeight,
  );
  const viewport = currentViewport(layoutHeight);

  useBodyScrollLock(true);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus({ preventScroll: true });
    return () => {
      previous?.focus({ preventScroll: true });
    };
  }, [title]);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    let fieldFrame = 0;
    const updateViewport = () => {
      const element = backdrop.current;
      if (!element) return;
      const next = currentViewport(layoutHeight);
      element.style.setProperty("--sheet-viewport-height", next.height);
      element.style.setProperty("--sheet-viewport-top", next.top);
      element.dataset.keyboardOpen = String(next.keyboardOpen);

      window.cancelAnimationFrame(fieldFrame);
      const field = document.activeElement;
      const scroller = scrollArea.current;
      if (
        (!(field instanceof HTMLInputElement) &&
          !(field instanceof HTMLTextAreaElement)) ||
        !scroller ||
        !scroller.contains(field)
      )
        return;
      fieldFrame = window.requestAnimationFrame(() => {
        const fieldBounds = field.getBoundingClientRect();
        const scrollBounds = scroller.getBoundingClientRect();
        const inset = 12;
        if (fieldBounds.bottom > scrollBounds.bottom - inset)
          scroller.scrollTop +=
            fieldBounds.bottom - scrollBounds.bottom + inset;
        else if (fieldBounds.top < scrollBounds.top + inset)
          scroller.scrollTop -= scrollBounds.top + inset - fieldBounds.top;
      });
    };
    updateViewport();
    visualViewport?.addEventListener("resize", updateViewport);
    visualViewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    const element = backdrop.current;
    element?.addEventListener("focusin", updateViewport);
    return () => {
      window.cancelAnimationFrame(fieldFrame);
      element?.removeEventListener("focusin", updateViewport);
      visualViewport?.removeEventListener("resize", updateViewport);
      visualViewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, [layoutHeight]);

  useEffect(() => {
    const element = backdrop.current;
    if (!element) return;
    let lastTouch: { x: number; y: number } | null = null;
    const start = (event: TouchEvent) => {
      const target = event.target;
      const touch = event.touches[0];
      lastTouch =
        event.touches.length === 1 &&
        target instanceof Element &&
        !target.closest(".sheet-handle-zone")
          ? { x: touch.clientX, y: touch.clientY }
          : null;
    };
    const move = (event: TouchEvent) => {
      if (!lastTouch || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dy = touch.clientY - lastTouch.y;
      const dx = touch.clientX - lastTouch.x;
      lastTouch = { x: touch.clientX, y: touch.clientY };
      // Leave taps, horizontal text selection and native control interactions alone.
      if (!dy || Math.abs(dx) >= Math.abs(dy)) return;
      let target = event.target instanceof Element ? event.target : null;
      while (target && target !== element) {
        const style = getComputedStyle(target);
        if (/^(auto|scroll|overlay)$/.test(style.overflowY)) {
          const limit = target.scrollHeight - target.clientHeight;
          if (limit > 0) {
            if (dy > 0 ? target.scrollTop > 0 : target.scrollTop < limit)
              return;
            // Respect a nested textarea/picker's own scroll boundary.
            if (/^(contain|none)$/.test(style.overscrollBehaviorY)) break;
          }
        }
        target = target.parentElement;
      }
      if (event.cancelable) event.preventDefault();
    };
    const end = () => {
      lastTouch = null;
    };
    element.addEventListener("touchstart", start, { passive: true });
    // React's delegated touch listeners are passive; this local listener must
    // cancel only vertical movement that no sheet scroller can consume.
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", end);
    element.addEventListener("touchcancel", end);
    return () => {
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", end);
    };
  }, []);

  const finishDrag = (clientY: number) => {
    if (dragStart.current === null) return;
    const distance = Math.max(0, clientY - dragStart.current);
    const elapsed = Math.max(1, performance.now() - dragStartedAt.current);
    const velocity = distance / elapsed;
    dragStart.current = null;
    setDragging(false);
    if (distance >= 88 || (distance >= 44 && velocity > 0.55)) onClose();
    else setDragY(0);
  };

  const style: SheetStyle = {
    "--sheet-drag-y": `${dragY}px`,
    "--sheet-viewport-height": viewport.height,
    "--sheet-viewport-top": viewport.top,
  };

  return (
    <div
      ref={backdrop}
      className={`modal sheet-backdrop${backdropClassName ? ` ${backdropClassName}` : ""}${closing ? " is-closing" : ""}`}
      style={style}
      data-keyboard-open={viewport.keyboardOpen}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        event.stopPropagation();
        onClose();
      }}
      onWheel={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <div
        ref={dialog}
        className={`bottom-sheet${className ? ` ${className}` : ""}${dragging ? " is-dragging" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const fields = dialog.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
          );
          if (!fields?.length) return;
          const first = fields[0];
          const last = fields[fields.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div
          className="sheet-handle-zone"
          aria-label="Fermer le panneau"
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onClose();
          }}
          onPointerDown={(event) => {
            dragStart.current = event.clientY;
            dragStartedAt.current = performance.now();
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStart.current === null) return;
            setDragY(Math.max(0, event.clientY - dragStart.current));
          }}
          onPointerUp={(event) => finishDrag(event.clientY)}
          onPointerCancel={() => {
            dragStart.current = null;
            setDragging(false);
            setDragY(0);
          }}
        >
          <span aria-hidden="true" />
        </div>
        <div ref={scrollArea} className="sheet-scroll">
          {children}
        </div>
      </div>
    </div>
  );
}

export { CLOSE_DURATION as bottomSheetCloseDuration };
