import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

type OrientationLock = {
  lock?: (orientation: "portrait") => Promise<void>;
};

export async function tryLockPortrait(orientation?: OrientationLock) {
  if (!orientation?.lock) return false;
  try {
    await orientation.lock("portrait");
    return true;
  } catch {
    return false;
  }
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function isMobile() {
  return (
    isStandalone() || window.matchMedia?.("(pointer: coarse)").matches === true
  );
}

function isLandscape() {
  return (
    window.matchMedia?.("(orientation: landscape)").matches ??
    window.innerWidth > window.innerHeight
  );
}

export function OrientationGuard() {
  const [mobile, setMobile] = useState(isMobile);
  const [landscape, setLandscape] = useState(isLandscape);
  const blockApp = mobile && landscape;

  useLayoutEffect(() => {
    const appRoot = document.getElementById("root");
    if (!appRoot) return;
    const wasInert = appRoot.inert;
    appRoot.inert = blockApp;
    return () => {
      appRoot.inert = wasInert;
    };
  }, [blockApp]);

  useEffect(() => {
    const update = () => {
      setMobile(isMobile());
      setLandscape(isLandscape());
    };
    const orientation = screen.orientation as ScreenOrientation &
      OrientationLock;
    if (isMobile()) void tryLockPortrait(orientation);
    const query = window.matchMedia?.("(orientation: landscape)");
    query?.addEventListener?.("change", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      query?.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  if (!mobile || !landscape) return null;

  return createPortal(
    <div className="orientation-guard" role="alertdialog" aria-modal="true">
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="17" y="6" width="14" height="27" rx="3" />
        <path d="M22 28h4M9 19a16 16 0 0 1 27-9M39 29a16 16 0 0 1-27 9M34 5l2 5-5 2M14 43l-2-5 5-2" />
      </svg>
      <p>Tournez votre téléphone en portrait</p>
    </div>,
    document.body,
  );
}
