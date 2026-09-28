import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { BottomNavigation } from "./BottomNavigation";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockNavigationBounds() {
  const surface = document.querySelector<HTMLElement>(
    ".bottom-navigation-surface",
  )!;
  const [workouts, nutrition] = screen.getAllByRole("button", {
    name: /^(Musculation|Nutrition)$/,
  });
  Object.defineProperty(surface, "offsetWidth", {
    configurable: true,
    value: 300,
  });
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
    x: 10,
    y: 100,
    left: 10,
    top: 100,
    right: 310,
    bottom: 144,
    width: 300,
    height: 44,
    toJSON: () => ({}),
  });
  vi.spyOn(workouts, "getBoundingClientRect").mockReturnValue({
    x: 14,
    y: 100,
    left: 14,
    top: 100,
    right: 158,
    bottom: 144,
    width: 144,
    height: 44,
    toJSON: () => ({}),
  });
  vi.spyOn(nutrition, "getBoundingClientRect").mockReturnValue({
    x: 162,
    y: 100,
    left: 162,
    top: 100,
    right: 306,
    bottom: 144,
    width: 144,
    height: 44,
    toJSON: () => ({}),
  });
  return { surface, workouts, nutrition };
}

it("shows Musculation as active and keeps Nutrition disabled", () => {
  const onWorkouts = vi.fn();
  render(<BottomNavigation onWorkouts={onWorkouts} />);
  expect(
    screen.getByRole("navigation", { name: "Navigation principale" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Musculation" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("button", { name: "Nutrition" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

it("does not navigate when Nutrition is tapped", () => {
  const onWorkouts = vi.fn();
  render(<BottomNavigation onWorkouts={onWorkouts} />);
  fireEvent.click(screen.getByRole("button", { name: "Nutrition" }));
  expect(onWorkouts).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Musculation" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("button", { name: "Nutrition" })).not.toHaveAttribute(
    "aria-current",
  );
});

it("shows an immediate pressed state and scrubs without selecting disabled Nutrition", () => {
  const onWorkouts = vi.fn();
  render(<BottomNavigation onWorkouts={onWorkouts} />);
  const { surface, workouts, nutrition } = mockNavigationBounds();
  fireEvent.pointerDown(workouts, {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: 70,
    clientY: 122,
  });
  expect(surface).toHaveClass("is-interacting");
  expect(workouts).toHaveAttribute("data-pressed", "true");
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientX: 240,
    clientY: 122,
  });
  expect(surface).toHaveAttribute("data-scrub-tab", "nutrition");
  expect(Number(surface.getAttribute("data-lens-stretch"))).toBeGreaterThan(1);
  fireEvent.pointerUp(surface, {
    pointerId: 1,
    clientX: 240,
    clientY: 122,
  });
  expect(surface).not.toHaveClass("is-interacting");
  expect(workouts).toHaveAttribute("aria-current", "page");
  expect(nutrition).not.toHaveAttribute("aria-current");
  expect(onWorkouts).not.toHaveBeenCalled();
});

it("keeps capture and the lens active during a large vertical pointer move", () => {
  const onWorkouts = vi.fn();
  render(<BottomNavigation onWorkouts={onWorkouts} />);
  const { surface, workouts } = mockNavigationBounds();
  const capture = vi.fn();
  Object.defineProperty(surface, "setPointerCapture", {
    configurable: true,
    value: capture,
  });
  fireEvent.pointerDown(workouts, {
    pointerId: 7,
    pointerType: "touch",
    clientX: 70,
    clientY: 122,
  });
  fireEvent.pointerMove(surface, {
    pointerId: 7,
    pointerType: "touch",
    clientX: 70,
    clientY: 500,
  });
  expect(capture).toHaveBeenCalledWith(7);
  expect(surface).toHaveClass("is-interacting");
  expect(surface).toHaveAttribute("data-lens-dragging", "true");
  expect(surface).toHaveAttribute("data-scrub-tab", "workouts");
  fireEvent.pointerCancel(surface, { pointerId: 7, pointerType: "touch" });
  expect(surface).not.toHaveClass("is-interacting");
  expect(surface).not.toHaveAttribute("data-lens-dragging");
  expect(onWorkouts).not.toHaveBeenCalled();
});

it("keeps the lens active outside the capsule and releases by horizontal target", () => {
  const onWorkouts = vi.fn();
  render(<BottomNavigation onWorkouts={onWorkouts} />);
  const { surface, workouts } = mockNavigationBounds();
  fireEvent.pointerDown(workouts, {
    pointerId: 8,
    pointerType: "touch",
    clientX: 70,
    clientY: 122,
  });
  fireEvent.pointerMove(surface, {
    pointerId: 8,
    pointerType: "touch",
    clientX: 240,
    clientY: 500,
  });
  expect(surface).toHaveClass("is-interacting");
  expect(surface).toHaveAttribute("data-lens-dragging", "true");
  expect(surface).toHaveAttribute("data-scrub-tab", "nutrition");
  expect(surface.style.getPropertyValue("--bottom-navigation-lens-x")).toBe(
    "146px",
  );
  fireEvent.pointerUp(surface, {
    pointerId: 8,
    pointerType: "touch",
    clientX: 500,
    clientY: 500,
  });
  expect(surface).not.toHaveClass("is-interacting");
  expect(screen.getByRole("button", { name: "Musculation" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("button", { name: "Nutrition" })).not.toHaveAttribute(
    "aria-current",
  );
  expect(onWorkouts).not.toHaveBeenCalled();
});

it("cancels a pointer release outside the capsule", () => {
  const onWorkouts = vi.fn();
  render(<BottomNavigation onWorkouts={onWorkouts} />);
  const { surface, workouts } = mockNavigationBounds();
  fireEvent.pointerDown(workouts, {
    pointerId: 2,
    pointerType: "mouse",
    button: 0,
    clientX: 70,
    clientY: 122,
  });
  fireEvent.pointerUp(surface, {
    pointerId: 2,
    clientX: 500,
    clientY: 500,
  });
  expect(surface).not.toHaveClass("is-interacting");
  expect(workouts).toHaveAttribute("aria-current", "page");
  expect(onWorkouts).not.toHaveBeenCalled();
});

it("minimizes after accumulated scroll, expands on upward scroll, and resets near the top", () => {
  render(<BottomNavigation onWorkouts={vi.fn()} />);
  const root = document.documentElement;
  Object.defineProperty(root, "scrollTop", {
    configurable: true,
    writable: true,
    value: 0,
  });
  root.scrollTop = 15;
  fireEvent.scroll(root);
  expect(screen.getByRole("navigation")).toHaveAttribute(
    "data-state",
    "expanded",
  );
  root.scrollTop = 30;
  fireEvent.scroll(root);
  expect(screen.getByRole("navigation")).toHaveAttribute(
    "data-state",
    "expanded",
  );
  root.scrollTop = 45;
  fireEvent.scroll(root);
  expect(screen.getByRole("navigation")).toHaveAttribute(
    "data-state",
    "minimized",
  );
  root.scrollTop = 80;
  fireEvent.scroll(root);
  root.scrollTop = 65;
  fireEvent.scroll(root);
  root.scrollTop = 50;
  fireEvent.scroll(root);
  expect(screen.getByRole("navigation")).toHaveAttribute(
    "data-state",
    "expanded",
  );
  root.scrollTop = 12;
  fireEvent.scroll(root);
  expect(screen.getByRole("navigation")).toHaveAttribute(
    "data-state",
    "expanded",
  );
});

it("keeps minimized labels accessible and expands on direct interaction", () => {
  render(<BottomNavigation onWorkouts={vi.fn()} />);
  const root = document.documentElement;
  Object.defineProperty(root, "scrollTop", {
    configurable: true,
    writable: true,
    value: 0,
  });
  root.scrollTop = 40;
  fireEvent.scroll(root);
  const navigation = screen.getByRole("navigation");
  expect(navigation).toHaveAttribute("data-state", "minimized");
  expect(
    screen.getByRole("button", { name: "Musculation" }),
  ).toBeInTheDocument();
  expect(
    document.querySelector<HTMLElement>(".bottom-navigation-label"),
  ).toHaveTextContent("Musculation");
  fireEvent.pointerDown(screen.getByRole("button", { name: "Musculation" }), {
    pointerId: 3,
    pointerType: "mouse",
    button: 0,
    clientX: 30,
    clientY: 122,
  });
  expect(navigation).toHaveAttribute("data-state", "expanded");
});

it("hides navigation while a modal is open and restores it when closed", () => {
  const onWorkouts = vi.fn();
  const view = render(<BottomNavigation onWorkouts={onWorkouts} />);
  const navigation = document.querySelector<HTMLElement>(".bottom-navigation")!;
  const surface = document.querySelector<HTMLElement>(
    ".bottom-navigation-surface",
  )!;
  const workouts = screen.getByRole("button", { name: "Musculation" });
  expect(navigation).not.toHaveAttribute("aria-hidden");
  expect(navigation).not.toHaveAttribute("data-modal-open");

  view.rerender(<BottomNavigation onWorkouts={onWorkouts} isModalOpen />);
  expect(navigation).toHaveAttribute("aria-hidden", "true");
  expect(navigation).toHaveAttribute("data-modal-open", "true");
  expect(surface.style.background).toBe("transparent");
  expect(surface.style.backdropFilter).toBe("none");
  fireEvent.scroll(document.createElement("div"));
  fireEvent.pointerDown(workouts, {
    pointerId: 9,
    pointerType: "mouse",
    button: 0,
  });
  fireEvent.click(workouts);
  expect(navigation).toHaveAttribute("data-state", "expanded");
  expect(surface).not.toHaveClass("is-interacting");
  expect(onWorkouts).not.toHaveBeenCalled();

  view.rerender(<BottomNavigation onWorkouts={onWorkouts} />);
  expect(navigation).not.toHaveAttribute("aria-hidden");
  expect(navigation).not.toHaveAttribute("data-modal-open");
  expect(surface.style.backdropFilter).toBe("");
});

it("cleans up passive scroll and reduced-motion listeners", () => {
  const media = {
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(media));
  const addListener = vi.spyOn(document, "addEventListener");
  const removeListener = vi.spyOn(document, "removeEventListener");
  const view = render(<BottomNavigation onWorkouts={vi.fn()} />);
  const scrollRegistration = addListener.mock.calls.find(
    ([type]) => type === "scroll",
  );
  expect(scrollRegistration?.[2]).toMatchObject({
    capture: true,
    passive: true,
  });
  view.unmount();
  expect(removeListener).toHaveBeenCalledWith(
    "scroll",
    scrollRegistration?.[1],
    true,
  );
  expect(media.removeEventListener).toHaveBeenCalledWith(
    "change",
    expect.any(Function),
  );
});

it("keeps the lens stable when reduced motion is enabled", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn() }),
  );
  render(<BottomNavigation onWorkouts={vi.fn()} />);
  const { surface, workouts } = mockNavigationBounds();
  fireEvent.pointerDown(workouts, {
    pointerId: 4,
    pointerType: "mouse",
    button: 0,
    clientX: 70,
    clientY: 122,
  });
  fireEvent.pointerMove(surface, {
    pointerId: 4,
    clientX: 240,
    clientY: 122,
  });
  expect(surface).toHaveAttribute("data-lens-stretch", "1");
  expect(surface).toHaveAttribute("data-scrub-tab", "nutrition");
});
