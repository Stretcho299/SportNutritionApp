import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ActiveRestTimer } from "./ActiveRestTimer";

it("renders the compact frozen-duration timer and keeps its finish action", () => {
  const onFinish = vi.fn();
  const { rerender } = render(
    <ActiveRestTimer remaining={25} total={30} onFinish={onFinish} />,
  );

  const timer = screen.getByRole("timer");
  expect(timer).toHaveTextContent("0:25");
  expect(timer).toHaveAttribute("data-reference-seconds", "30");
  expect(timer.querySelector(".countdown-value")).toHaveAttribute(
    "stroke-dashoffset",
    String(100 * (1 - 25 / 30)),
  );
  fireEvent.click(within(timer).getByRole("button", { name: "Fin de repos" }));
  expect(onFinish).toHaveBeenCalledOnce();

  rerender(<ActiveRestTimer remaining={24} total={30} onFinish={onFinish} />);
  expect(screen.getByRole("timer")).toHaveAttribute(
    "data-reference-seconds",
    "30",
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
