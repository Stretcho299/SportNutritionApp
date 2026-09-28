import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Icon } from "./Icon";

type TabId = "workouts" | "nutrition";
type TabConfig = {
  id: TabId;
  label: string;
  icon: "dumbbell" | "nutrition";
  enabled: boolean;
  onSelect?: () => void;
};
type Scrub = {
  pointerId: number;
  startX: number;
  startY: number;
  startTab: TabId;
  didScrub: boolean;
  scrubbedTab: TabId;
};
type LensStyle = CSSProperties & {
  "--bottom-navigation-lens-x"?: string;
  "--bottom-navigation-lens-stretch"?: number;
};

// Scroll movement is accumulated to avoid changing state on trackpad/touch jitter.
const SCROLL_HYSTERESIS_PX = 28;
const TOP_RESET_PX = 18;
const TAB_INSET_PX = 4;
const SCRUB_START_PX = 8;

export function BottomNavigation({
  onWorkouts,
  isModalOpen = false,
}: {
  onWorkouts: () => void;
  isModalOpen?: boolean;
}) {
  const tabs: TabConfig[] = [
    {
      id: "workouts",
      label: "Musculation",
      icon: "dumbbell",
      enabled: true,
      onSelect: onWorkouts,
    },
    {
      id: "nutrition",
      label: "Nutrition",
      icon: "nutrition",
      enabled: false,
    },
  ];
  const [activeTab, setActiveTab] = useState<TabId>("workouts");
  const [minimized, setMinimized] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [pressedTab, setPressedTab] = useState<TabId | null>(null);
  const [scrubbedTab, setScrubbedTab] = useState<TabId | null>(null);
  const [lensX, setLensX] = useState<number | null>(null);
  const [lensStretch, setLensStretch] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  const buttonRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    workouts: null,
    nutrition: null,
  });
  const scrub = useRef<Scrub | null>(null);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (isModalOpen) return;

    const positions = new Map<EventTarget, number>();
    const root = document.scrollingElement;
    if (root) positions.set(root, root.scrollTop);
    positions.set(document, window.scrollY);
    if (document.documentElement)
      positions.set(
        document.documentElement,
        document.documentElement.scrollTop,
      );
    if (document.body) positions.set(document.body, document.body.scrollTop);
    const initialSets = document.querySelector<HTMLElement>(".planned-sets");
    if (initialSets) positions.set(initialSets, initialSets.scrollTop);
    let previousSource: EventTarget | null = null;
    let accumulatedDirection = 0;
    let accumulatedDistance = 0;

    const onScroll = (event: Event) => {
      const main = document.querySelector<HTMLElement>(".app-shell");
      const isWorkoutDetail =
        main?.classList.contains("workout-detail") ?? false;
      const target = event.target;
      let source: Element | Document;
      let position: number;

      if (isWorkoutDetail) {
        const sets = main?.querySelector<HTMLElement>(".planned-sets");
        if (!sets || target !== sets) return;
        source = sets;
        position = sets.scrollTop;
      } else {
        const scrollingElement = document.scrollingElement;
        if (
          target !== document &&
          target !== scrollingElement &&
          target !== document.documentElement &&
          target !== document.body
        )
          return;
        source = target instanceof Element ? target : document;
        position =
          target instanceof Element ? target.scrollTop : window.scrollY;
      }

      position = Math.max(0, position);
      if (previousSource !== source) {
        previousSource = source;
        accumulatedDirection = 0;
        accumulatedDistance = 0;
      }
      const previous = positions.get(source) ?? 0;
      positions.set(source, position);
      if (position <= TOP_RESET_PX) {
        accumulatedDirection = 0;
        accumulatedDistance = 0;
        setMinimized(false);
        return;
      }

      const delta = position - previous;
      if (delta === 0) return;
      const direction = delta > 0 ? 1 : -1;
      if (direction !== accumulatedDirection) accumulatedDistance = 0;
      accumulatedDirection = direction;
      accumulatedDistance += Math.abs(delta);
      if (accumulatedDistance >= SCROLL_HYSTERESIS_PX) {
        setMinimized(direction > 0);
        accumulatedDistance = 0;
      }
    };

    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () => document.removeEventListener("scroll", onScroll, true);
  }, [isModalOpen]);

  const selectTab = (tabId: TabId) => {
    if (isModalOpen) return;
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab?.enabled) return;
    setActiveTab(tabId);
    setMinimized(false);
    tab.onSelect?.();
  };

  const resetScrub = () => {
    scrub.current = null;
    setInteracting(false);
    setPressedTab(null);
    setScrubbedTab(null);
    setLensX(null);
    setLensStretch(1);
  };

  const tabAtPoint = (clientX: number, clientY: number): TabId | null => {
    for (const tab of tabs) {
      const bounds = buttonRefs.current[tab.id]?.getBoundingClientRect();
      if (
        bounds &&
        clientX >= bounds.left &&
        clientX <= bounds.right &&
        clientY >= bounds.top &&
        clientY <= bounds.bottom
      )
        return tab.id;
    }
    return null;
  };

  const tabAtX = (clientX: number, bounds: DOMRect): TabId =>
    clientX < bounds.left + bounds.width / 2 ? "workouts" : "nutrition";

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isModalOpen || (event.pointerType === "mouse" && event.button !== 0))
      return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-tab-id]");
    const tabId = button?.dataset.tabId as TabId | undefined;
    if (!tabId) return;

    const lensWidth = Math.max(
      0,
      (event.currentTarget.offsetWidth - TAB_INSET_PX * 2) / 2,
    );
    scrub.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTab: tabId,
      didScrub: false,
      scrubbedTab: tabId,
    };
    setInteracting(true);
    setPressedTab(tabId);
    setScrubbedTab(tabId);
    setLensX(tabId === "nutrition" ? lensWidth : 0);
    setLensStretch(1);
    setMinimized(false);
    if (event.currentTarget.setPointerCapture)
      event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = scrub.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - current.startX;
    const deltaY = event.clientY - current.startY;
    if (!current.didScrub && Math.hypot(deltaX, deltaY) <= SCRUB_START_PX)
      return;
    current.didScrub = true;

    const bounds = event.currentTarget.getBoundingClientRect();
    const layoutWidth = event.currentTarget.offsetWidth;
    const scaleX = bounds.width / layoutWidth || 1;
    const lensWidth = Math.max(0, (layoutWidth - TAB_INSET_PX * 2) / 2);
    const travel = lensWidth;
    const localX =
      (event.clientX - (bounds.left + bounds.width / 2)) / scaleX +
      layoutWidth / 2;
    const nextX = Math.min(
      travel,
      Math.max(0, localX - TAB_INSET_PX - lensWidth / 2),
    );
    const nextTab = tabAtX(event.clientX, bounds);
    current.scrubbedTab = nextTab;
    setLensX(nextX);
    setScrubbedTab(nextTab);
    setLensStretch(
      reducedMotion ? 1 : 1 + Math.min(0.12, Math.abs(deltaX) / 240),
    );
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = scrub.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const movedPastTap =
      Math.hypot(
        event.clientX - current.startX,
        event.clientY - current.startY,
      ) > SCRUB_START_PX;
    const bounds = event.currentTarget.getBoundingClientRect();
    const releaseTab =
      current.didScrub || movedPastTap
        ? tabAtX(event.clientX, bounds)
        : (tabAtPoint(event.clientX, event.clientY) ?? current.startTab);
    resetScrub();
    if (releaseTab) selectTab(releaseTab);
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (scrub.current?.pointerId === event.pointerId) resetScrub();
  };

  const style: LensStyle = {
    "--bottom-navigation-lens-x": lensX === null ? undefined : `${lensX}px`,
    "--bottom-navigation-lens-stretch": lensStretch,
    ...(isModalOpen
      ? {
          background: "transparent",
          boxShadow: "none",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
          transition: "none",
        }
      : {}),
  };

  return (
    <nav
      className="bottom-navigation"
      aria-label="Navigation principale"
      aria-hidden={isModalOpen || undefined}
      data-state={minimized ? "minimized" : "expanded"}
      data-modal-open={isModalOpen ? "true" : undefined}
    >
      <div
        className={`bottom-navigation-surface${minimized ? " is-minimized" : ""}${interacting ? " is-interacting" : ""}`}
        data-active-tab={activeTab}
        data-scrub-tab={scrubbedTab ?? undefined}
        data-lens-stretch={lensStretch}
        data-lens-dragging={lensX === null ? undefined : "true"}
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
      >
        <span className="bottom-navigation-lens" aria-hidden="true" />
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(element) => {
              buttonRefs.current[tab.id] = element;
            }}
            className={`bottom-navigation-tab${activeTab === tab.id ? " active" : ""}`}
            type="button"
            data-tab-id={tab.id}
            data-pressed={pressedTab === tab.id ? "true" : undefined}
            aria-label={tab.label}
            aria-current={activeTab === tab.id ? "page" : undefined}
            aria-disabled={tab.enabled ? undefined : "true"}
            title={tab.enabled ? undefined : "Bientôt disponible"}
            onClick={(event) => {
              if (event.detail === 0) selectTab(tab.id);
            }}
          >
            <Icon name={tab.icon} size={23} strokeWidth={1.9} />
            <span className="bottom-navigation-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
