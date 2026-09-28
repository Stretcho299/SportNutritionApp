import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { OrientationGuard, tryLockPortrait } from "./OrientationGuard";

afterEach(() => {
  cleanup();
  document.getElementById("root")?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("does not fail when the orientation lock API is unavailable", async () => {
  await expect(tryLockPortrait(undefined)).resolves.toBe(false);
});

it("locks portrait when the orientation API accepts the request", async () => {
  const lock = vi.fn().mockResolvedValue(undefined);
  await expect(tryLockPortrait({ lock })).resolves.toBe(true);
  expect(lock).toHaveBeenCalledWith("portrait");
});

it("handles a rejected portrait orientation lock", async () => {
  const lock = vi.fn().mockRejectedValue(new Error("Not allowed"));
  await expect(tryLockPortrait({ lock })).resolves.toBe(false);
  expect(lock).toHaveBeenCalledWith("portrait");
});

it("shows the landscape fallback on a coarse-pointer device and hides it in portrait", () => {
  let landscape = true;
  const matchMedia = vi.fn((query: string) => ({
    matches:
      query === "(pointer: coarse)" ||
      (query === "(orientation: landscape)" && landscape),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("matchMedia", matchMedia);
  vi.stubGlobal("screen", { orientation: {} });
  const view = render(<OrientationGuard />);
  expect(screen.getByRole("alertdialog").textContent).toContain(
    "Tournez votre téléphone en portrait",
  );
  landscape = false;
  fireEvent(window, new Event("resize"));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  view.unmount();
});
it("does not show the fallback in portrait", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(pointer: coarse)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("screen", { orientation: {} });
  render(<OrientationGuard />);
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

it("makes the app inert in landscape and restores it in portrait", () => {
  let landscape = true;
  const root = document.createElement("div");
  root.id = "root";
  root.inert = false;
  document.body.append(root);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches:
      query === "(pointer: coarse)" ||
      (query === "(orientation: landscape)" && landscape),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("screen", { orientation: {} });

  const view = render(<OrientationGuard />);
  expect(root.inert).toBe(true);
  landscape = false;
  fireEvent(window, new Event("resize"));
  expect(root.inert).toBe(false);
  view.unmount();
  expect(root.inert).toBe(false);
});

it("removes orientation and resize listeners on unmount", () => {
  const mediaAdd = vi.fn();
  const mediaRemove = vi.fn();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: mediaAdd,
    removeEventListener: mediaRemove,
  }));
  vi.stubGlobal("screen", { orientation: {} });
  const addWindowListener = vi.spyOn(window, "addEventListener");
  const removeWindowListener = vi.spyOn(window, "removeEventListener");
  const view = render(<OrientationGuard />);

  expect(mediaAdd).toHaveBeenCalledWith("change", expect.any(Function));
  expect(addWindowListener).toHaveBeenCalledWith(
    "resize",
    expect.any(Function),
  );
  expect(addWindowListener).toHaveBeenCalledWith(
    "orientationchange",
    expect.any(Function),
  );
  view.unmount();
  expect(mediaRemove).toHaveBeenCalledWith("change", expect.any(Function));
  expect(removeWindowListener).toHaveBeenCalledWith(
    "resize",
    expect.any(Function),
  );
  expect(removeWindowListener).toHaveBeenCalledWith(
    "orientationchange",
    expect.any(Function),
  );
});
