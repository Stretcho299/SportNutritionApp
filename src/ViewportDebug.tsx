import { useEffect, useState } from "react";

type Snapshot = {
  innerHeight: number;
  clientHeight: number;
  bodyScrollHeight: number;
  documentScrollHeight: number;
  scrollY: number;
  visualHeight: number | null;
  visualOffsetTop: number | null;
  visualPageTop: number | null;
  visualScale: number | null;
  navTop: number | null;
  navBottom: number | null;
  navBottomStyle: string | null;
  shellTop: number | null;
  shellBottom: number | null;
  standalone: boolean;
};

export function ViewportDebug() {
  const enabled = new URLSearchParams(window.location.search).has(
    "debugViewport",
  );
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const nav = document.querySelector<HTMLElement>(".bottom-navigation");
      const shell = document.querySelector<HTMLElement>(".app-shell");
      const navBounds = nav?.getBoundingClientRect();
      const shellBounds = shell?.getBoundingClientRect();
      const visual = window.visualViewport;
      setSnapshot({
        innerHeight: window.innerHeight,
        clientHeight: document.documentElement.clientHeight,
        bodyScrollHeight: document.body.scrollHeight,
        documentScrollHeight: document.documentElement.scrollHeight,
        scrollY: window.scrollY,
        visualHeight: visual?.height ?? null,
        visualOffsetTop: visual?.offsetTop ?? null,
        visualPageTop: visual?.pageTop ?? null,
        visualScale: visual?.scale ?? null,
        navTop: navBounds?.top ?? null,
        navBottom: navBounds?.bottom ?? null,
        navBottomStyle: nav ? getComputedStyle(nav).bottom : null,
        shellTop: shellBounds?.top ?? null,
        shellBottom: shellBounds?.bottom ?? null,
        standalone: window.matchMedia("(display-mode: standalone)").matches,
      });
    };
    update();
    const visual = window.visualViewport;
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    visual?.addEventListener("resize", update);
    visual?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      visual?.removeEventListener("resize", update);
      visual?.removeEventListener("scroll", update);
    };
  }, [enabled]);

  if (!enabled || !snapshot) return null;
  return (
    <pre className="viewport-debug" aria-hidden="true">
      {JSON.stringify(snapshot, null, 2)}
    </pre>
  );
}
