import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { triggerHaptic } from "./haptics";
import { ExerciseNavigator } from "./ExerciseNavigator";
import type { Exercise } from "./storage/database";

vi.mock("./haptics", () => ({ triggerHaptic: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

const exercises: Exercise[] = [
  { id: "one", name: "Squat", position: 0, plannedSets: [] },
  { id: "two", name: "Row", position: 1, plannedSets: [] },
];

afterEach(() => vi.useRealTimers());

it("activates the reorder clone from touch after the long-press delay", () => {
  vi.useFakeTimers();
  render(
    <ExerciseNavigator
      exercises={exercises}
      selectedExerciseId="one"
      statusFor={() => "upcoming"}
      onSelect={() => undefined}
      onReorder={() => undefined}
    />,
  );
  const button = screen.getAllByRole("button")[0];
  const touch = { identifier: 7, clientX: 20, clientY: 20 };

  fireEvent.touchStart(button, { touches: [touch], changedTouches: [touch] });
  expect(button).not.toHaveAttribute("aria-grabbed", "true");

  act(() => vi.advanceTimersByTime(299));
  expect(triggerHaptic).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(triggerHaptic).toHaveBeenCalledExactlyOnceWith("light");
  expect(button).toHaveAttribute("aria-grabbed", "true");
  expect(document.querySelector(".exercise-tab-drag-clone")).toBeVisible();

  fireEvent.touchMove(document, {
    touches: [{ ...touch, clientX: 80 }],
    changedTouches: [{ ...touch, clientX: 80 }],
  });
  expect(document.querySelector(".exercise-tab-drag-clone")).toBeVisible();

  fireEvent.touchEnd(document, {
    touches: [],
    changedTouches: [{ ...touch, clientX: 80 }],
  });
  expect(document.querySelector(".exercise-tab-drag-clone")).toBeNull();
  expect(triggerHaptic).toHaveBeenCalledExactlyOnceWith("light");
});

it("uses the touch reorder state for edge auto-scroll", () => {
  vi.useFakeTimers();
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  render(
    <ExerciseNavigator
      exercises={exercises}
      selectedExerciseId="one"
      statusFor={() => "upcoming"}
      onSelect={() => undefined}
      onReorder={() => undefined}
    />,
  );
  const rail = screen.getByRole("list", { name: "Exercices" });
  Object.defineProperty(rail, "scrollLeft", {
    configurable: true,
    writable: true,
    value: 40,
  });
  Object.defineProperty(rail, "scrollWidth", {
    configurable: true,
    value: 240,
  });
  Object.defineProperty(rail, "clientWidth", {
    configurable: true,
    value: 100,
  });
  vi.spyOn(rail, "getBoundingClientRect").mockReturnValue({
    left: 0,
    right: 100,
    top: 0,
    bottom: 44,
    width: 100,
    height: 44,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const button = screen.getAllByRole("button")[0];
  const touch = { identifier: 8, clientX: 20, clientY: 20 };
  fireEvent.touchStart(button, { touches: [touch], changedTouches: [touch] });
  act(() => vi.advanceTimersByTime(301));
  fireEvent.touchMove(document, {
    touches: [{ ...touch, clientX: 99 }],
    changedTouches: [{ ...touch, clientX: 99 }],
  });
  act(() => frames.shift()?.(0));
  expect(rail.scrollLeft).toBeGreaterThan(40);
  expect(triggerHaptic).toHaveBeenCalledExactlyOnceWith("light");
  fireEvent.touchEnd(document, {
    touches: [],
    changedTouches: [{ ...touch, clientX: 99 }],
  });
});

it("announces pointer reorder once at the threshold, never on movement or drop", () => {
  vi.useFakeTimers();
  render(
    <ExerciseNavigator
      exercises={exercises}
      selectedExerciseId="one"
      statusFor={() => "upcoming"}
      onSelect={vi.fn()}
      onReorder={vi.fn()}
    />,
  );
  const button = screen.getAllByRole("button")[0];
  button.setPointerCapture = vi.fn();
  button.hasPointerCapture = vi.fn(() => false);
  const pointer = {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: 20,
    clientY: 20,
  };
  fireEvent.pointerDown(button, pointer);
  act(() => vi.advanceTimersByTime(299));
  expect(triggerHaptic).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(button).toHaveAttribute("aria-grabbed", "true");
  expect(triggerHaptic).toHaveBeenCalledExactlyOnceWith("light");
  fireEvent.pointerMove(button, { ...pointer, clientX: 80 });
  fireEvent.pointerUp(button, { ...pointer, clientX: 80 });
  expect(button).not.toHaveAttribute("aria-grabbed", "true");
  expect(triggerHaptic).toHaveBeenCalledExactlyOnceWith("light");
});

it.each(["touch", "pointer"])("keeps a refused %s reorder silent", (input) => {
  vi.useFakeTimers();
  render(
    <ExerciseNavigator
      exercises={exercises}
      selectedExerciseId="one"
      statusFor={() => "upcoming"}
      onSelect={vi.fn()}
      onReorder={vi.fn()}
      canDrag={() => false}
    />,
  );
  const button = screen.getAllByRole("button")[0];
  if (input === "touch") {
    const touch = { identifier: 7, clientX: 20, clientY: 20 };
    fireEvent.touchStart(button, { touches: [touch], changedTouches: [touch] });
  } else {
    fireEvent.pointerDown(button, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
    });
  }
  act(() => vi.advanceTimersByTime(300));
  expect(button).not.toHaveAttribute("aria-grabbed", "true");
  expect(triggerHaptic).not.toHaveBeenCalled();
});

it.each(["touch", "pointer"])(
  "keeps a %s gesture cancelled before the threshold silent",
  (input) => {
    vi.useFakeTimers();
    render(
      <ExerciseNavigator
        exercises={exercises}
        selectedExerciseId="one"
        statusFor={() => "upcoming"}
        onSelect={vi.fn()}
        onReorder={vi.fn()}
      />,
    );
    const button = screen.getAllByRole("button")[0];
    if (input === "touch") {
      const touch = { identifier: 7, clientX: 20, clientY: 20 };
      fireEvent.touchStart(button, {
        touches: [touch],
        changedTouches: [touch],
      });
      fireEvent.touchMove(document, { touches: [{ ...touch, clientX: 40 }] });
      fireEvent.touchCancel(document);
    } else {
      button.hasPointerCapture = vi.fn(() => false);
      const pointer = {
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        clientX: 20,
        clientY: 20,
      };
      fireEvent.pointerDown(button, pointer);
      fireEvent.pointerMove(button, { ...pointer, clientX: 40 });
      fireEvent.pointerCancel(button, pointer);
    }
    act(() => vi.advanceTimersByTime(300));
    expect(triggerHaptic).not.toHaveBeenCalled();
  },
);
