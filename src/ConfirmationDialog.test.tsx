import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import {
  ConfirmationDialog,
  type ConfirmationRequest,
} from "./ConfirmationDialog";
import { triggerHaptic } from "./haptics";

vi.mock("./haptics", () => ({ triggerHaptic: vi.fn() }));

const request: ConfirmationRequest = {
  title: "Supprimer cette série ?",
  description: "Cette action est définitive.",
  confirmLabel: "Supprimer",
  onConfirm: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

it("announces an opening once despite StrictMode and request rerenders", () => {
  const { rerender, unmount } = render(
    <StrictMode>
      <ConfirmationDialog request={request} onCancel={vi.fn()} />
    </StrictMode>,
  );
  expect(triggerHaptic).toHaveBeenCalledExactlyOnceWith("medium");
  rerender(
    <StrictMode>
      <ConfirmationDialog request={{ ...request }} onCancel={vi.fn()} />
    </StrictMode>,
  );
  expect(triggerHaptic).toHaveBeenCalledTimes(1);
  unmount();
  render(<ConfirmationDialog request={request} onCancel={vi.fn()} />);
  expect(triggerHaptic).toHaveBeenCalledTimes(2);
});

it("does not repeat feedback on generic confirmation", () => {
  vi.useFakeTimers();
  render(<ConfirmationDialog request={request} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
  act(() => vi.advanceTimersByTime(180));
  expect(request.onConfirm).toHaveBeenCalledTimes(1);
  expect(triggerHaptic).toHaveBeenCalledExactlyOnceWith("medium");
});

it("does not repeat feedback on cancellation", () => {
  vi.useFakeTimers();
  const onCancel = vi.fn();
  render(<ConfirmationDialog request={request} onCancel={onCancel} />);
  fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
  act(() => vi.advanceTimersByTime(180));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(triggerHaptic).toHaveBeenCalledExactlyOnceWith("medium");
});

it("keeps an explicitly silent confirmation silent through its action", () => {
  vi.useFakeTimers();
  render(
    <ConfirmationDialog
      request={{ ...request, haptic: false }}
      onCancel={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
  act(() => vi.advanceTimersByTime(180));
  expect(request.onConfirm).toHaveBeenCalledTimes(1);
  expect(triggerHaptic).not.toHaveBeenCalled();
});
