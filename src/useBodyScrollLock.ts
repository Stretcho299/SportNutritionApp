import { useEffect } from "react";

let lockCount = 0;
let lockedScrollY = 0;
let previousStyles: Partial<CSSStyleDeclaration> = {};

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    lockCount += 1;
    if (lockCount === 1) {
      lockedScrollY = window.scrollY;
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
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount !== 0) return;
      Object.assign(document.body.style, previousStyles);
      if (lockedScrollY !== 0)
        window.scrollTo({ top: lockedScrollY, behavior: "auto" });
    };
  }, [active]);
}
