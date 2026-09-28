import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BottomSheet } from "./BottomSheet";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
