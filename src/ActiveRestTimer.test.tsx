import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ActiveRestTimer } from "./ActiveRestTimer";

it("renders the compact informative rest timer without a finish action", () => {
  const { rerender, container } = render(
    <ActiveRestTimer remaining={25} total={30} />,
  );

  const timer = screen.getByRole("timer", { name: "Temps de repos restant" });
  expect(timer).toHaveTextContent("0:25");
  expect(timer).toHaveAttribute("data-reference-seconds", "30");
  expect(timer.querySelector(".countdown-value")).toHaveAttribute(
    "stroke-dashoffset",
    String(100 * (1 - 25 / 30)),
  );
  expect(timer.querySelector(".rest-ring")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Fin de repos" })).toBeNull();
  expect(container.querySelector(".mini-timer-finish")).toBeNull();

  rerender(<ActiveRestTimer remaining={24} total={30} />);
  expect(
    screen.getByRole("timer", { name: "Temps de repos restant" }),
  ).toHaveAttribute("data-reference-seconds", "30");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
