import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ViewportDebug } from "./ViewportDebug";

afterEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

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
