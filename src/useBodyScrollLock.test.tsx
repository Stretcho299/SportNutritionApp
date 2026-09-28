import { act, cleanup, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useBodyScrollLock } from "./useBodyScrollLock";

const originalVisualViewport = Object.getOwnPropertyDescriptor(
  window,
  "visualViewport",
);

function restoreVisualViewport() {
  if (originalVisualViewport)
    Object.defineProperty(window, "visualViewport", originalVisualViewport);
  else
    delete (window as unknown as { visualViewport?: VisualViewport })[
      "visualViewport"
    ];
}

afterEach(() => {
  cleanup();
  document.querySelector(".app-shell")?.remove();
  restoreVisualViewport();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function ScrollLock({ active }: { active: boolean }) {
  useBodyScrollLock(active);
  return null;
}

function createAppShell() {
  const shell = document.createElement("main");
  shell.className = "app-shell";
  const sets = document.createElement("section");
  sets.className = "planned-sets";
  sets.style.overflowY = "auto";
  shell.append(sets);
  document.body.append(shell);
  sets.scrollTop = 137;
  return { shell, sets };
}

it("locks app scroll containers and restores their exact scroll positions", () => {
  const { shell, sets } = createAppShell();
  const view = render(<ScrollLock active />);

  expect(shell).toHaveAttribute("data-modal-open", "true");
  expect(sets.style.overflowY).toBe("hidden");
  expect(sets.scrollTop).toBe(137);

  sets.scrollTop = 0;
  view.rerender(<ScrollLock active={false} />);

  expect(shell).not.toHaveAttribute("data-modal-open");
  expect(sets.style.overflowY).toBe("auto");
  expect(sets.scrollTop).toBe(137);
});

it("restores document scroll after the body lock is released", () => {
  vi.stubGlobal("scrollY", 84);
  const scrollTo = vi
    .spyOn(window, "scrollTo")
    .mockImplementation(() => undefined);
  const { shell } = createAppShell();
  const view = render(<ScrollLock active />);

  expect(document.body.style.position).toBe("fixed");
  expect(document.body.style.top).toBe("-84px");
  expect(shell).toHaveAttribute("data-modal-open", "true");

  view.rerender(<ScrollLock active={false} />);

  expect(scrollTo).toHaveBeenCalledWith({ top: 84, behavior: "auto" });
  expect(document.body.style.position).toBe("");
  expect(shell).not.toHaveAttribute("data-modal-open");
});

it("compensates visual pan without fighting document scroll, then restores on release", async () => {
  let offsetTop = 0;
  let simulatedScrollY = 84;
  const viewport = new EventTarget() as VisualViewport;
  Object.defineProperties(viewport, {
    offsetTop: { configurable: true, get: () => offsetTop },
    height: { configurable: true, value: 844 },
  });
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: viewport,
  });
  vi.stubGlobal("scrollY", simulatedScrollY);
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => simulatedScrollY,
  });
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {
    simulatedScrollY = 84;
  });
  const { shell, sets } = createAppShell();
  const view = render(<ScrollLock active />);

  expect(shell).toHaveAttribute("data-modal-open", "true");
  expect(
    shell.style.getPropertyValue("--modal-background-viewport-offset"),
  ).toBe("0px");

  await act(async () => {
    offsetTop = 96;
    Object.defineProperty(viewport, "height", {
      configurable: true,
      value: 430,
    });
    viewport.dispatchEvent(new Event("resize"));
    viewport.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  });
  expect(
    shell.style.getPropertyValue("--modal-background-viewport-offset"),
  ).toBe("96px");
  expect(shell).toHaveAttribute("data-viewport-panned", "true");

  sets.scrollTop = 0;
  sets.dispatchEvent(new Event("scroll", { bubbles: true }));
  simulatedScrollY = 0;
  window.dispatchEvent(new Event("scroll"));
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  expect(sets.scrollTop).toBe(137);
  expect(simulatedScrollY).toBe(0);
  expect(scrollTo).not.toHaveBeenCalled();
  for (const top of [-24, 60, 0]) {
    offsetTop = top;
    simulatedScrollY = -top;
    viewport.dispatchEvent(new Event("scroll"));
    viewport.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("scroll"));
    expect(
      shell.style.getPropertyValue("--modal-background-viewport-offset"),
    ).toBe(`${top}px`);
    expect(scrollTo).not.toHaveBeenCalled();
  }
  expect(shell).toHaveAttribute("data-modal-open", "true");

  view.rerender(<ScrollLock active={false} />);
  expect(shell).not.toHaveAttribute("data-modal-open");
  expect(shell).not.toHaveAttribute("data-viewport-panned");
  expect(
    shell.style.getPropertyValue("--modal-background-viewport-offset"),
  ).toBe("");
  expect(sets.style.overflowY).toBe("auto");

  expect(scrollTo).toHaveBeenCalledTimes(1);
  expect(scrollTo).toHaveBeenCalledWith({ top: 84, behavior: "auto" });

  offsetTop = 24;
  viewport.dispatchEvent(new Event("scroll"));
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  expect(
    shell.style.getPropertyValue("--modal-background-viewport-offset"),
  ).toBe("");
});

it("restores a zero document origin after pan and waits for the last nested lock", () => {
  vi.stubGlobal("scrollY", 0);
  const scrollTo = vi
    .spyOn(window, "scrollTo")
    .mockImplementation(() => undefined);
  createAppShell();
  const first = render(<ScrollLock active />);
  const second = render(<ScrollLock active />);
  vi.stubGlobal("scrollY", -36);
  window.dispatchEvent(new Event("scroll"));
  first.unmount();
  expect(scrollTo).not.toHaveBeenCalled();
  expect(document.body.style.position).toBe("fixed");
  second.unmount();
  expect(scrollTo).toHaveBeenCalledExactlyOnceWith({
    top: 0,
    behavior: "auto",
  });
  expect(document.body.style.position).toBe("");
});

it("does not lock a sheet scroller nested inside the app shell", () => {
  const { shell } = createAppShell();
  const modal = document.createElement("div");
  modal.className = "modal";
  const scroller = document.createElement("div");
  scroller.style.overflowY = "auto";
  Object.defineProperties(scroller, {
    scrollHeight: { value: 600 },
    clientHeight: { value: 200 },
  });
  modal.append(scroller);
  shell.append(modal);
  render(<ScrollLock active />);
  expect(scroller.style.overflowY).toBe("auto");
  scroller.scrollTop = 100;
  scroller.dispatchEvent(new Event("scroll"));
  expect(scroller.scrollTop).toBe(100);
});
