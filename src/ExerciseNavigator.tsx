import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import type { Exercise, ExerciseExecutionStatus } from "./storage/database";

const LONG_PRESS_MS = 300;
const MOVE_SLOP = 8;
const EDGE_SIZE = 44;

type TimelineGesture = {
  index: number;
  pointerId: number;
  button: HTMLButtonElement;
  startX: number;
  startY: number;
  lastX: number;
  mode: "pending" | "timelineScroll" | "cancelled" | "reordering";
};

export function ExerciseNavigator({
  exercises,
  selectedExerciseId,
  statusFor,
  onSelect,
  onReorder,
  canDrag,
  canReorder,
}: {
  exercises: Exercise[];
  selectedExerciseId: string;
  statusFor: (exerciseId: string) => ExerciseExecutionStatus | undefined;
  onSelect: (exerciseId: string) => void;
  onReorder?: (from: number, to: number) => void;
  canDrag?: (index: number) => boolean;
  canReorder?: (from: number, to: number) => boolean;
}) {
  const selectedIndex = Math.max(
    0,
    exercises.findIndex((exercise) => exercise.id === selectedExerciseId),
  );
  const tabs = useRef<HTMLUListElement>(null);
  const gesture = useRef<TimelineGesture | null>(null);
  const longPressTimer = useRef<number | undefined>(undefined);
  const autoScrollFrame = useRef<number | undefined>(undefined);
  const lastPointerX = useRef(0);
  const suppressClick = useRef(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const clearAutoScroll = () => {
    if (autoScrollFrame.current !== undefined) {
      window.cancelAnimationFrame(autoScrollFrame.current);
      autoScrollFrame.current = undefined;
    }
  };

  const clearGesture = () => {
    window.clearTimeout(longPressTimer.current);
    longPressTimer.current = undefined;
    clearAutoScroll();
    const active = gesture.current;
    gesture.current = null;
    if (active?.button.hasPointerCapture(active.pointerId)) {
      active.button.releasePointerCapture(active.pointerId);
    }
    setDraggingIndex(null);
    setDragOffset(0);
    setDropIndex(null);
  };

  const findDropIndex = (clientX: number, from: number) => {
    const list = tabs.current;
    const active = gesture.current;
    if (!list || !active) return from;
    const items = Array.from(list.children) as HTMLElement[];
    const source = items[from];
    if (!source) return from;
    const sourceBounds = source.getBoundingClientRect();
    const dragCenter =
      sourceBounds.left + sourceBounds.width / 2 + (clientX - active.startX);
    const centers = items.map((item) => {
      const bounds = item.getBoundingClientRect();
      return bounds.left + bounds.width / 2;
    });
    let target = from;
    while (target < centers.length - 1 && dragCenter > centers[target + 1])
      target += 1;
    while (target > 0 && dragCenter < centers[target - 1]) target -= 1;
    return canReorder?.(from, target) === false ? from : target;
  };

  const updateAutoScroll = (clientX: number) => {
    const list = tabs.current;
    const active = gesture.current;
    if (!list || !active || active.mode !== "reordering") {
      clearAutoScroll();
      return;
    }
    const bounds = list.getBoundingClientRect();
    const direction =
      clientX < bounds.left + EDGE_SIZE
        ? -1
        : clientX > bounds.right - EDGE_SIZE
          ? 1
          : 0;
    if (!direction) {
      clearAutoScroll();
      return;
    }
    if (autoScrollFrame.current !== undefined) return;
    const tick = () => {
      const current = gesture.current;
      if (!current || current.mode !== "reordering") {
        clearAutoScroll();
        return;
      }
      const edgeDistance =
        direction < 0
          ? Math.max(0, bounds.left + EDGE_SIZE - lastPointerX.current)
          : Math.max(0, lastPointerX.current - (bounds.right - EDGE_SIZE));
      list.scrollLeft += direction * Math.min(10, 3 + edgeDistance / 8);
      setDropIndex(findDropIndex(lastPointerX.current, current.index));
      autoScrollFrame.current = window.requestAnimationFrame(tick);
    };
    autoScrollFrame.current = window.requestAnimationFrame(tick);
  };

  useEffect(
    () => () => {
      window.clearTimeout(longPressTimer.current);
      if (autoScrollFrame.current !== undefined)
        window.cancelAnimationFrame(autoScrollFrame.current);
    },
    [],
  );

  const startLongPress = (index: number, button: HTMLButtonElement) => {
    const active = gesture.current;
    if (!active || active.mode !== "pending" || canDrag?.(index) === false)
      return;
    active.mode = "reordering";
    setDraggingIndex(index);
    setDropIndex(index);
    button.setPointerCapture(active.pointerId);
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.button !== 0 || gesture.current) return;
    const active: TimelineGesture = {
      index,
      pointerId: event.pointerId,
      button: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      mode: "pending",
    };
    gesture.current = active;
    lastPointerX.current = event.clientX;
    const button = event.currentTarget;
    longPressTimer.current = window.setTimeout(
      () => startLongPress(index, button),
      LONG_PRESS_MS,
    );
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    active.lastX = event.clientX;
    lastPointerX.current = event.clientX;
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    if (active.mode === "pending") {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < MOVE_SLOP) return;
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
      active.mode =
        Math.abs(dx) > Math.abs(dy) * 1.1 ? "timelineScroll" : "cancelled";
      if (active.mode === "timelineScroll") gesture.current = null;
      return;
    }
    if (active.mode !== "reordering") return;
    event.preventDefault();
    setDragOffset(dx);
    setDropIndex(findDropIndex(event.clientX, active.index));
    updateAutoScroll(event.clientX);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (active.mode === "reordering") {
      const moved =
        Math.max(
          Math.abs(event.clientX - active.startX),
          Math.abs(event.clientY - active.startY),
        ) >= MOVE_SLOP;
      if (moved) {
        const target = dropIndex ?? active.index;
        if (
          target !== active.index &&
          canReorder?.(active.index, target) !== false
        )
          onReorder?.(active.index, target);
        suppressClick.current = true;
      }
    }
    clearGesture();
  };

  return (
    <section
      className="exercise-navigator"
      aria-label="Navigation des exercices"
    >
      <div className="exercise-navigator-copy" aria-live="polite">
        <span>Exercices</span>
        <strong>
          {selectedIndex + 1} / {exercises.length}
        </strong>
      </div>
      <ul
        ref={tabs}
        className={`exercise-tabs${draggingIndex !== null ? " is-reordering" : ""}`}
        aria-label="Exercices"
      >
        {exercises.map((exercise, index) => {
          const status = statusFor(exercise.id) ?? "upcoming";
          const selected = exercise.id === selectedExerciseId;
          const dragging = draggingIndex === index;
          const target = dropIndex === index && draggingIndex !== null;
          const shiftsLeft =
            draggingIndex !== null &&
            dropIndex !== null &&
            draggingIndex < dropIndex &&
            index > draggingIndex &&
            index <= dropIndex;
          const shiftsRight =
            draggingIndex !== null &&
            dropIndex !== null &&
            draggingIndex > dropIndex &&
            index >= dropIndex &&
            index < draggingIndex;
          return (
            <li
              className={`${selected ? "selected " : ""}execution-${status}${dragging ? " is-reordering" : ""}${target ? " reorder-target" : ""}${shiftsLeft ? " reorder-shift-left" : ""}${shiftsRight ? " reorder-shift-right" : ""}`}
              key={exercise.id}
            >
              <button
                className="exercise-tab"
                aria-pressed={selected}
                aria-grabbed={dragging || undefined}
                style={
                  dragging
                    ? { transform: `translateX(${dragOffset}px)` }
                    : undefined
                }
                onPointerDown={(event) => handlePointerDown(event, index)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={clearGesture}
                onLostPointerCapture={(event) => {
                  if (gesture.current?.pointerId === event.pointerId)
                    clearGesture();
                }}
                onClick={() => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  onSelect(exercise.id);
                }}
              >
                <span className="exercise-tab-circle" aria-hidden="true">
                  {status === "completed" ? (
                    <Icon name="check" size={18} strokeWidth={2.4} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span className="sr-only">
                  {exercise.name} ·{" "}
                  {status === "completed"
                    ? "Terminé"
                    : status === "active"
                      ? "En cours"
                      : "À venir"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
