import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ActiveWorkoutCapsule } from "./ActiveWorkoutCapsule";
import type { SetExecutionStatus, WorkoutExecution } from "./storage/database";

const executionWith = (statuses: SetExecutionStatus[]): WorkoutExecution => ({
  status: "inProgress",
  startedAt: 100_000,
  exercises: [
    {
      exerciseId: "exercise",
      status: "active",
      sets: statuses.map((status, index) => ({
        setId: String(index),
        status,
        repetitions: null,
        weightKg: null,
        restSeconds: 90,
      })),
    },
  ],
});

it.each([
  [125_000, "02:05"],
  [3_723_000, "1:02:03"],
])("formats the active session duration from startedAt", (elapsed, label) => {
  render(
    <ActiveWorkoutCapsule
      name="Séance longue"
      execution={executionWith(["active"])}
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

it("counts performed and skipped sets, and updates the remaining count from execution", () => {
  const renderCapsule = (execution: WorkoutExecution) => (
    <ActiveWorkoutCapsule
      name="Push"
      execution={execution}
      now={100_000}
      onResume={vi.fn()}
    />
  );
  const view = render(
    renderCapsule(
      executionWith(["performed", "skipped", "resting", "active", "upcoming"]),
    ),
  );
  expect(screen.getByText("2 terminées · 3 restantes")).toBeVisible();
  view.rerender(
    renderCapsule(
      executionWith([
        "performed",
        "skipped",
        "performed",
        "active",
        "upcoming",
      ]),
    ),
  );
  expect(screen.getByText("3 terminées · 2 restantes")).toBeVisible();
  view.rerender(
    renderCapsule({
      ...executionWith(["performed", "skipped"]),
      status: "readyToFinish",
    }),
  );
  expect(screen.getByText("2 terminées · 0 restantes")).toBeVisible();
});

it("retains settled archived sets in the progress like the workout progress", () => {
  const execution = executionWith(["active"]);
  execution.archivedExercises = executionWith([
    "performed",
    "skipped",
  ]).exercises;
  render(
    <ActiveWorkoutCapsule
      name="Push"
      execution={execution}
      now={100_000}
      onResume={vi.fn()}
    />,
  );
  expect(screen.getByText("2 terminées · 1 restante")).toBeVisible();
});
