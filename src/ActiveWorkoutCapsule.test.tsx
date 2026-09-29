import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ActiveWorkoutCapsule } from "./ActiveWorkoutCapsule";

it.each([
  [125_000, "02:05"],
  [3_723_000, "1:02:03"],
])("formats the active session duration from startedAt", (elapsed, label) => {
  render(
    <ActiveWorkoutCapsule
      name="Séance longue"
      startedAt={100_000}
      now={100_000 + elapsed}
      onResume={vi.fn()}
    />,
  );

  expect(
    screen.getByRole("button", { name: "Reprendre la séance Séance longue" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("timer", { name: "Durée de la séance en cours" }),
  ).toHaveTextContent(label);
  expect(
    screen.getByRole("timer", { name: "Durée de la séance en cours" }),
  ).toHaveAttribute("data-started-at", "100000");
});
