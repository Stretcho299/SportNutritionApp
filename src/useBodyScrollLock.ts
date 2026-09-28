import { useEffect } from "react";

let lockCount = 0;
let lockedScrollY = 0;
let previousStyles: Partial<CSSStyleDeclaration> = {};
let lockedAppShell: HTMLElement | null = null;
let previousModalOpenAttribute: string | null = null;
let previousViewportOffset = "";
let previousViewportPannedAttribute: string | null = null;
let lockedVisualViewportTop = 0;
let scrollRestoreListener: (() => void) | null = null;
let visualViewportListener: (() => void) | null = null;
let lockedScrollContainers: Array<{
  element: HTMLElement;
  scrollTop: number;
  overflowY: string;
  overscrollBehaviorY: string;
}> = [];

function restoreLockedScrollPositions() {
  for (const container of lockedScrollContainers) {
    if (container.element.scrollTop !== container.scrollTop)
      container.element.scrollTop = container.scrollTop;
  }
}

function updateBackgroundViewportOffset() {
  if (!lockedAppShell) return;
  const visualViewportTop = window.visualViewport?.offsetTop ?? 0;
  // The fixed body is anchored to the layout viewport. Counter only the visual
  // viewport offset; never scroll the document in response to a native iOS pan.
  const offset = visualViewportTop - lockedVisualViewportTop;
  lockedAppShell.style.setProperty(
    "--modal-background-viewport-offset",
    `${offset}px`,
  );
  if (Math.abs(offset) > 0.5)
    lockedAppShell.setAttribute("data-viewport-panned", "true");
  else lockedAppShell.removeAttribute("data-viewport-panned");
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    lockCount += 1;
    if (lockCount === 1) {
      lockedScrollY = window.scrollY;
      lockedVisualViewportTop = window.visualViewport?.offsetTop ?? 0;
      previousStyles = {
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
        overflow: document.body.style.overflow,
      };
      Object.assign(document.body.style, {
        position: "fixed",
        top: `-${lockedScrollY}px`,
        left: "0",
        right: "0",
        width: "100%",
        overflow: "hidden",
      });

      lockedAppShell = document.querySelector<HTMLElement>(".app-shell");
      if (lockedAppShell) {
        previousModalOpenAttribute =
          lockedAppShell.getAttribute("data-modal-open");
        previousViewportOffset = lockedAppShell.style.getPropertyValue(
          "--modal-background-viewport-offset",
        );
        previousViewportPannedAttribute = lockedAppShell.getAttribute(
          "data-viewport-panned",
        );
        lockedAppShell.style.setProperty(
          "--modal-background-viewport-offset",
          "0px",
        );
        lockedScrollContainers = [
          lockedAppShell,
          ...lockedAppShell.querySelectorAll<HTMLElement>("*"),
        ]
          .filter((element) => {
            if (element.closest(".modal")) return false;
            const overflowY = getComputedStyle(element).overflowY;
            return (
              (overflowY === "auto" ||
                overflowY === "scroll" ||
                overflowY === "overlay") &&
              (element.scrollHeight > element.clientHeight ||
                element.matches(".planned-sets"))
            );
          })
          .map((element) => ({
            element,
            scrollTop: element.scrollTop,
            overflowY: element.style.overflowY,
            overscrollBehaviorY: element.style.overscrollBehaviorY,
          }));

        lockedAppShell.setAttribute("data-modal-open", "true");
        for (const container of lockedScrollContainers) {
          container.element.style.overflowY = "hidden";
          container.element.style.overscrollBehaviorY = "none";
        }

        scrollRestoreListener = restoreLockedScrollPositions;
        visualViewportListener = updateBackgroundViewportOffset;
        lockedAppShell.addEventListener("scroll", scrollRestoreListener, true);
        window.visualViewport?.addEventListener(
          "resize",
          visualViewportListener,
          { passive: true },
        );
        window.visualViewport?.addEventListener(
          "scroll",
          visualViewportListener,
          { passive: true },
        );
      }
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount !== 0) return;

      if (scrollRestoreListener) {
        lockedAppShell?.removeEventListener(
          "scroll",
          scrollRestoreListener,
          true,
        );
      }
      if (visualViewportListener) {
        window.visualViewport?.removeEventListener(
          "resize",
          visualViewportListener,
        );
        window.visualViewport?.removeEventListener(
          "scroll",
          visualViewportListener,
        );
      }
      scrollRestoreListener = null;
      visualViewportListener = null;

      if (lockedAppShell) {
        if (previousModalOpenAttribute === null)
          lockedAppShell.removeAttribute("data-modal-open");
        else
          lockedAppShell.setAttribute(
            "data-modal-open",
            previousModalOpenAttribute,
          );
        if (previousViewportPannedAttribute === null)
          lockedAppShell.removeAttribute("data-viewport-panned");
        else
          lockedAppShell.setAttribute(
            "data-viewport-panned",
            previousViewportPannedAttribute,
          );
        if (previousViewportOffset)
          lockedAppShell.style.setProperty(
            "--modal-background-viewport-offset",
            previousViewportOffset,
          );
        else
          lockedAppShell.style.removeProperty(
            "--modal-background-viewport-offset",
          );
      }
      for (const container of lockedScrollContainers) {
        container.element.style.overflowY = container.overflowY;
        container.element.style.overscrollBehaviorY =
          container.overscrollBehaviorY;
        container.element.scrollTop = container.scrollTop;
      }
      lockedScrollContainers = [];
      lockedAppShell = null;
      previousModalOpenAttribute = null;
      previousViewportOffset = "";
      previousViewportPannedAttribute = null;

      Object.assign(document.body.style, previousStyles);
      if (lockedScrollY !== 0 || window.scrollY !== lockedScrollY)
        window.scrollTo({ top: lockedScrollY, behavior: "auto" });
    };
  }, [active]);
}
