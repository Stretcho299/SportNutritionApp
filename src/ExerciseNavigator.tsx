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
  mode: "pending" | "cancelled" | "reordering";
};

type TouchGesture = TimelineGesture;

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
  const touchGesture = useRef<TouchGesture | null>(null);
  const touchListeners = useRef<{
    move: (event: TouchEvent) => void;
    end: (event: TouchEvent) => void;
    cancel: () => void;
  } | null>(null);
  const longPressTimer = useRef<number | undefined>(undefined);
  const autoScrollFrame = useRef<number | undefined>(undefined);
  const lastPointerX = useRef(0);
  const suppressClick = useRef(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
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
    setDragPosition(null);
    setDropIndex(null);
  };

  const findDropIndex = (clientX: number, from: number) => {
    const list = tabs.current;
    const active = gesture.current ?? touchGesture.current;
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
    const active = gesture.current ?? touchGesture.current;
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
      const current = gesture.current ?? touchGesture.current;
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
      const listeners = touchListeners.current;
      if (listeners) {
        document.removeEventListener("touchmove", listeners.move);
        document.removeEventListener("touchend", listeners.end);
        document.removeEventListener("touchcancel", listeners.cancel);
      }
      touchListeners.current = null;
      touchGesture.current = null;
    },
    [],
  );

  const startLongPress = (index: number, button: HTMLButtonElement) => {
    const active = gesture.current;
    if (!active || active.mode !== "pending" || canDrag?.(index) === false)
      return;
    active.mode = "reordering";
    const bounds = button.getBoundingClientRect();
    setDraggingIndex(index);
    setDropIndex(index);
    setDragPosition({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    });
    button.setPointerCapture(active.pointerId);
  };

  const finishTouchGesture = (
    commit: boolean,
    clientX: number,
    clientY: number,
  ) => {
    const active = touchGesture.current;
    if (!active) return;
    if (commit && active.mode === "reordering") {
      const moved =
        Math.max(
          Math.abs(clientX - active.startX),
          Math.abs(clientY - active.startY),
        ) >= MOVE_SLOP;
      if (moved) {
        const target = findDropIndex(clientX, active.index);
        if (
          target !== active.index &&
          canReorder?.(active.index, target) !== false
        )
          onReorder?.(active.index, target);
        suppressClick.current = true;
      }
    }
    window.clearTimeout(longPressTimer.current);
    longPressTimer.current = undefined;
    clearAutoScroll();
    touchGesture.current = null;
    const listeners = touchListeners.current;
    if (listeners) {
      document.removeEventListener("touchmove", listeners.move);
      document.removeEventListener("touchend", listeners.end);
      document.removeEventListener("touchcancel", listeners.cancel);
      touchListeners.current = null;
    }
    setDraggingIndex(null);
    setDragPosition(null);
    setDropIndex(null);
  };

  const handleTouchStart = (
    event: React.TouchEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (touchGesture.current || gesture.current) return;
    const button = event.currentTarget;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const active: TouchGesture = {
      index,
      pointerId: touch.identifier,
      button,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      mode: "pending",
    };
    touchGesture.current = active;
    lastPointerX.current = touch.clientX;
    longPressTimer.current = window.setTimeout(() => {
      const current = touchGesture.current;
      if (!current || current.mode !== "pending" || canDrag?.(index) === false)
        return;
      current.mode = "reordering";
      const bounds = button.getBoundingClientRect();
      setDraggingIndex(index);
      setDropIndex(index);
      setDragPosition({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      });
    }, LONG_PRESS_MS);

    const move = (moveEvent: TouchEvent) => {
      const current = touchGesture.current;
      const point = Array.from(moveEvent.touches).find(
        (item) => item.identifier === touch.identifier,
      );
      if (!current || !point) return;
      lastPointerX.current = point.clientX;
      current.lastX = point.clientX;
      const dx = point.clientX - current.startX;
      const dy = point.clientY - current.startY;
      if (current.mode === "pending") {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < MOVE_SLOP) return;
        window.clearTimeout(longPressTimer.current);
        longPressTimer.current = undefined;
        current.mode = "cancelled";
        return;
      }
      if (current.mode !== "reordering") return;
      moveEvent.preventDefault();
      setDragPosition({ x: point.clientX, y: point.clientY });
      setDropIndex(findDropIndex(point.clientX, current.index));
      updateAutoScroll(point.clientX);
    };
    const end = (endEvent: TouchEvent) => {
      const point = Array.from(endEvent.changedTouches).find(
        (item) => item.identifier === touch.identifier,
      );
      finishTouchGesture(
        true,
        point?.clientX ?? active.lastX,
        point?.clientY ?? active.startY,
      );
    };
    const cancel = () => finishTouchGesture(false, active.lastX, active.startY);
    touchListeners.current = { move, end, cancel };
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", cancel);
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.pointerType === "touch" || event.button !== 0 || gesture.current)
      return;
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
    if (event.pointerType === "touch") return;
    if (!active || active.pointerId !== event.pointerId) return;
    lastPointerX.current = event.clientX;
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    if (active.mode === "pending") {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < MOVE_SLOP) return;
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
      active.mode = "cancelled";
      return;
    }
    if (active.mode !== "reordering") return;
    event.preventDefault();
    setDragPosition({ x: event.clientX, y: event.clientY });
    setDropIndex(findDropIndex(event.clientX, active.index));
    updateAutoScroll(event.clientX);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const active = gesture.current;
    if (event.pointerType === "touch") return;
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

  const draggedExercise =
    draggingIndex === null ? null : exercises[draggingIndex];
  const draggedStatus = draggedExercise
    ? (statusFor(draggedExercise.id) ?? "upcoming")
    : null;

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
                onPointerDown={(event) => handlePointerDown(event, index)}
                onTouchStart={(event) => handleTouchStart(event, index)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={(event) => {
                  if (event.pointerType !== "touch") clearGesture();
                }}
                onLostPointerCapture={(event) => {
                  if (
                    event.pointerType !== "touch" &&
                    gesture.current?.pointerId === event.pointerId
                  )
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
      {draggingIndex !== null && draggedExercise && dragPosition && (
        <div
          className="exercise-tab-drag-clone"
          style={{ left: dragPosition.x, top: dragPosition.y }}
          aria-hidden="true"
        >
          <span className="exercise-tab-circle">
            {draggedStatus === "completed" ? (
              <Icon name="check" size={18} strokeWidth={2.4} />
            ) : (
              String(draggingIndex + 1).padStart(2, "0")
            )}
          </span>
        </div>
      )}
    </section>
  );
}
