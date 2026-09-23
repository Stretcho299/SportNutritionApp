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
  "--visual-viewport-height"?: string;
  "--visual-viewport-top"?: string;
};

function currentViewport() {
  return {
    height: window.visualViewport?.height ?? window.innerHeight,
    top: window.visualViewport?.offsetTop ?? 0,
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
  const viewport = currentViewport();

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
    const updateViewport = () => {
      const element = backdrop.current;
      if (!element) return;
      const next = currentViewport();
      element.style.setProperty("--visual-viewport-height", `${next.height}px`);
      element.style.setProperty("--visual-viewport-top", `${next.top}px`);
      element.dataset.keyboardOpen = String(
        next.height < window.innerHeight - 80,
      );

      const field = document.activeElement;
      const scroller = scrollArea.current;
      if (!(field instanceof HTMLInputElement) || !scroller) return;
      window.requestAnimationFrame(() => {
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
    return () => {
      visualViewport?.removeEventListener("resize", updateViewport);
      visualViewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
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
    "--visual-viewport-height": `${viewport.height}px`,
    "--visual-viewport-top": `${viewport.top}px`,
  };

  return (
    <div
      ref={backdrop}
      className={`modal sheet-backdrop${backdropClassName ? ` ${backdropClassName}` : ""}${closing ? " is-closing" : ""}`}
      style={style}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
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
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key !== "Tab") return;
          const fields = dialog.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex='-1'])",
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
