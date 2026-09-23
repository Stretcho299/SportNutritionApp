import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ViewportDebug } from "./ViewportDebug";

afterEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(window.navigator, "standalone", {
    configurable: true,
    value: undefined,
  });
});

function setStandalone(value: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: value })),
  });
}

it("persists debug mode when enabled by query parameter", async () => {
  window.history.replaceState({}, "", "/?debugViewport=1");
  render(<ViewportDebug />);

  await waitFor(() => expect(screen.getByText(/innerHeight/)).toBeVisible());
  expect(localStorage.getItem("debugViewport")).toBe("1");
});

it("restores debug mode without a query parameter", async () => {
  localStorage.setItem("debugViewport", "1");
  render(<ViewportDebug />);

  await waitFor(() => expect(screen.getByText(/innerHeight/)).toBeVisible());
});

it("disables and clears debug mode with debugViewport=0", async () => {
  localStorage.setItem("debugViewport", "1");
  window.history.replaceState({}, "", "/?debugViewport=0");
  render(<ViewportDebug />);

  await waitFor(() => expect(localStorage.getItem("debugViewport")).toBeNull());
  expect(screen.queryByText(/innerHeight/)).not.toBeInTheDocument();
});

it("shows no overlay in Safari without debug state", async () => {
  render(<ViewportDebug />);
  await waitFor(() =>
    expect(screen.queryByText(/innerHeight/)).not.toBeInTheDocument(),
  );
});

it("forces debug mode in display-mode standalone", async () => {
  setStandalone(true);
  render(<ViewportDebug />);
  await waitFor(() => expect(screen.getByText(/innerHeight/)).toBeVisible());
});

it("forces debug mode with the iOS standalone navigator flag", async () => {
  Object.defineProperty(window.navigator, "standalone", {
    configurable: true,
    value: true,
  });
  render(<ViewportDebug />);
  await waitFor(() => expect(screen.getByText(/innerHeight/)).toBeVisible());
});
