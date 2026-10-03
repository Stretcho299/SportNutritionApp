import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ExerciseNavigator } from "./ExerciseNavigator";
import type { Exercise } from "./storage/database";

const exercises: Exercise[] = [
  { id: "one", name: "Squat", position: 0, plannedSets: [] },
  { id: "two", name: "Row", position: 1, plannedSets: [] },
];
const longTimeline: Exercise[] = Array.from({ length: 8 }, (_, index) => ({
  id: "exercise-" + (index + 1),
  name: "Exercise " + (index + 1),
  position: index,
  plannedSets: [],
}));

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

  act(() => vi.advanceTimersByTime(301));
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
  fireEvent.touchEnd(document, {
    touches: [],
    changedTouches: [{ ...touch, clientX: 99 }],
  });
});

it("reorders between offscreen ends in one continuous edge drag", () => {
  vi.useFakeTimers();
  const frames: FrameRequestCallback[] = [];
  let frameId = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    frameId += 1;
    return frameId;
  });
  const onReorder = vi.fn();
  render(
    <ExerciseNavigator
      exercises={longTimeline}
      selectedExerciseId="exercise-1"
      statusFor={() => "upcoming"}
      onSelect={() => undefined}
      onReorder={onReorder}
    />,
  );
  const rail = screen.getByRole("list", { name: "Exercices" });
  let scrollLeft = 0;
  Object.defineProperty(rail, "scrollLeft", {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = Math.max(0, Math.min(300, value));
    },
  });
  Object.defineProperty(rail, "scrollWidth", {
    configurable: true,
    value: 400,
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
  const items = Array.from(rail.children) as HTMLElement[];
  items.forEach((item, index) => {
    const getBounds = () => {
      const left = index * 50 - scrollLeft;
      return {
        left,
        right: left + 40,
        top: 0,
        bottom: 44,
        width: 40,
        height: 44,
        x: left,
        y: 0,
        toJSON: () => ({}),
      };
    };
    vi.spyOn(item, "getBoundingClientRect").mockImplementation(getBounds);
    vi.spyOn(
      item.querySelector("button")!,
      "getBoundingClientRect",
    ).mockImplementation(getBounds);
  });
  const runEdgeScroll = () => {
    act(() => {
      for (let frame = 0; frame < 40; frame += 1) frames.shift()?.(frame);
    });
  };
  const touch = { identifier: 20, clientX: 20, clientY: 20 };
  fireEvent.touchStart(screen.getAllByRole("button")[0], {
    touches: [touch],
    changedTouches: [touch],
  });
  act(() => vi.advanceTimersByTime(301));
  fireEvent.touchMove(document, {
    touches: [{ ...touch, clientX: 99 }],
    changedTouches: [{ ...touch, clientX: 99 }],
  });
  runEdgeScroll();
  expect(rail.scrollLeft).toBe(300);
  expect(items[7]).toHaveClass("reorder-target");
  fireEvent.touchEnd(document, {
    touches: [],
    changedTouches: [{ ...touch, clientX: 99 }],
  });
  expect(onReorder).toHaveBeenNthCalledWith(1, 0, 7);

  frames.length = 0;
  rail.scrollLeft = 300;
  const reverseTouch = { identifier: 21, clientX: 70, clientY: 20 };
  fireEvent.touchStart(screen.getAllByRole("button")[7], {
    touches: [reverseTouch],
    changedTouches: [reverseTouch],
  });
  act(() => vi.advanceTimersByTime(301));
  fireEvent.touchMove(document, {
    touches: [{ ...reverseTouch, clientX: 1 }],
    changedTouches: [{ ...reverseTouch, clientX: 1 }],
  });
  runEdgeScroll();
  expect(rail.scrollLeft).toBe(0);
  expect(items[0]).toHaveClass("reorder-target");
  fireEvent.touchEnd(document, {
    touches: [],
    changedTouches: [{ ...reverseTouch, clientX: 1 }],
  });
  expect(onReorder).toHaveBeenNthCalledWith(2, 7, 0);
});
