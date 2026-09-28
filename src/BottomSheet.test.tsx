import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BottomSheet } from "./BottomSheet";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps the sheet open when its backdrop is clicked", () => {
  const onClose = vi.fn();
  render(
    <BottomSheet title="Test" onClose={onClose}>
      <button type="button">Valider</button>
    </BottomSheet>,
  );

  const backdrop = document.querySelector<HTMLElement>(".sheet-backdrop")!;
  fireEvent.click(backdrop);

  expect(screen.getByRole("dialog", { name: "Test" })).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

it("closes only after a downward drag on the handle", () => {
  const onClose = vi.fn();
  render(
    <BottomSheet title="Test" onClose={onClose}>
      <button type="button">Valider</button>
    </BottomSheet>,
  );

  const handle = screen.getByRole("button", { name: "Fermer le panneau" });
  handle.setPointerCapture = vi.fn();
  fireEvent.pointerDown(handle, { pointerId: 1, clientY: 10 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 110 });
  fireEvent.pointerUp(handle, { pointerId: 1, clientY: 110 });

  expect(onClose).toHaveBeenCalledTimes(1);
});

it("closes when an explicit validation action calls onClose", () => {
  const onClose = vi.fn();
  render(
    <BottomSheet title="Test" onClose={onClose}>
      <button type="button" onClick={onClose}>
        Valider
      </button>
    </BottomSheet>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Valider" }));

  expect(onClose).toHaveBeenCalledTimes(1);
});

it.each([797, 0])(
  "detects the first keyboard event with transient innerHeight (clientHeight %i)",
  (clientHeight) => {
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
      clientHeight,
    );
    vi.stubGlobal("innerHeight", 797);
    let height = 797;
    let offsetTop = 0;
    const visualViewport = new EventTarget();
    Object.defineProperties(visualViewport, {
      height: { get: () => height },
      offsetTop: { get: () => offsetTop },
    });
    vi.stubGlobal("visualViewport", visualViewport);
    const view = render(
      <BottomSheet title="Keyboard" onClose={() => {}}>
        <input aria-label="Name" />
      </BottomSheet>,
    );
    const backdrop = document.querySelector<HTMLElement>(".sheet-backdrop")!;
    expect(backdrop).toHaveAttribute("data-keyboard-open", "false");
    expect(backdrop.style.getPropertyValue("--sheet-viewport-height")).toBe(
      "var(--app-viewport-height, 100dvh)",
    );
    vi.stubGlobal("innerHeight", 441);
    height = 441;
    act(() => visualViewport.dispatchEvent(new Event("resize")));
    expect(backdrop).toHaveAttribute("data-keyboard-open", "true");
    expect(backdrop.style.getPropertyValue("--sheet-viewport-height")).toBe(
      "441px",
    );
    expect(backdrop.style.getPropertyValue("--sheet-viewport-top")).toBe("0px");
    // A later React render (e.g. typing or handle drag) must not undo the update.
    view.rerender(
      <BottomSheet title="Keyboard" onClose={() => {}}>
        <input aria-label="Name" />
      </BottomSheet>,
    );
    expect(backdrop).toHaveAttribute("data-keyboard-open", "true");
    for (const top of [96, -24, 0]) {
      offsetTop = top;
      act(() => visualViewport.dispatchEvent(new Event("scroll")));
      expect(backdrop.style.getPropertyValue("--sheet-viewport-top")).toBe(
        `${top}px`,
      );
    }
    vi.stubGlobal("innerHeight", 797);
    height = 797;
    act(() => visualViewport.dispatchEvent(new Event("resize")));
    expect(backdrop).toHaveAttribute("data-keyboard-open", "false");
    expect(backdrop.style.getPropertyValue("--sheet-viewport-height")).toBe(
      "var(--app-viewport-height, 100dvh)",
    );
  },
);

function swipe(target: Element, dy: number, dx = 0) {
  fireEvent.touchStart(target, { touches: [{ clientX: 100, clientY: 100 }] });
  return fireEvent.touchMove(target, {
    touches: [{ clientX: 100 + dx, clientY: 100 + dy }],
    cancelable: true,
  });
}

it("contains only unconsumable vertical gestures and preserves fields and handle", () => {
  render(
    <BottomSheet title="Touch" onClose={() => {}}>
      <textarea aria-label="Notes" />
    </BottomSheet>,
  );
  const scroll = document.querySelector<HTMLElement>(".sheet-scroll")!;
  scroll.style.overflowY = "auto";
  Object.defineProperties(scroll, {
    scrollHeight: { configurable: true, value: 600 },
    clientHeight: { value: 200 },
  });
  expect(swipe(scroll, 30)).toBe(false);
  expect(swipe(scroll, -30)).toBe(true);
  scroll.scrollTop = 200;
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  scroll.append(icon);
  expect(swipe(icon, -30)).toBe(true);
  expect(swipe(scroll, 30)).toBe(true);
  expect(swipe(scroll, -30)).toBe(true);
  scroll.scrollTop = 400;
  expect(swipe(scroll, -30)).toBe(false);
  expect(swipe(scroll, 30)).toBe(true);
  Object.defineProperty(scroll, "scrollHeight", { value: 200 });
  scroll.scrollTop = 0;
  expect(swipe(scroll, 30)).toBe(false);
  expect(swipe(scroll, -30)).toBe(false);
  const notes = screen.getByRole("textbox", { name: "Notes" });
  notes.style.overflowY = "auto";
  Object.defineProperties(notes, {
    scrollHeight: { value: 300 },
    clientHeight: { value: 100 },
  });
  notes.scrollTop = 50;
  expect(swipe(notes, 30)).toBe(true);
  expect(swipe(notes, -30)).toBe(true);
  notes.scrollTop = 0;
  expect(swipe(notes, 30)).toBe(false);
  expect(swipe(notes, 0, 30)).toBe(true);
  expect(
    fireEvent.touchStart(notes, { touches: [{ clientX: 100, clientY: 100 }] }),
  ).toBe(true);
  fireEvent.change(notes, { target: { value: "Brouillon" } });
  expect(notes).toHaveValue("Brouillon");
  expect(
    swipe(screen.getByRole("button", { name: "Fermer le panneau" }), 100),
  ).toBe(true);
  expect(
    swipe(document.querySelector<HTMLElement>(".sheet-backdrop")!, -30),
  ).toBe(false);
});
