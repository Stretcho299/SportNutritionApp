import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { WorkoutProgress } from "./WorkoutProgress";
import { ActiveRestTimer } from "./ActiveRestTimer";
import { formatSessionDuration } from "./formatSessionDuration";
import {
  addExercise,
  createWorkout,
  startWorkoutExecution,
} from "./storage/database";

it("counts only treated sets and keeps the real rest visible when another exercise is selected", () => {
  const workout = addExercise(
    addExercise(createWorkout("Force"), "Squat", 4),
    "Row",
    1,
  );
  const execution = startWorkoutExecution(workout, 1000);
  execution.exercises[0].sets[0].status = "performed";
  execution.exercises[0].sets[1].status = "skipped";
  execution.exercises[0].sets[2] = {
    ...execution.exercises[0].sets[2],
    status: "resting",
    restSeconds: 150,
    restEndsAt: 91000,
    restDurationSeconds: 90,
  };
  const before = structuredClone(execution);
  render(
    <WorkoutProgress
      workout={workout}
      execution={execution}
      clock={31000}
      onFinishRest={() => undefined}
      selectedExerciseId={workout.exercises[1].id}
    />,
  );
  expect(screen.getByRole("progressbar")).toHaveAttribute("value", "2");
  expect(screen.getByRole("progressbar")).toHaveAttribute("max", "5");
  expect(screen.getByText("Squat · Série 3")).toBeInTheDocument();
  expect(
    screen.getByRole("timer", { name: "Temps de repos restant" }),
  ).toHaveTextContent("1:00");
  expect(
    screen.getByRole("timer", { name: "Temps de repos restant" }),
  ).toHaveAttribute("data-reference-seconds", "90");
  expect(
    screen
      .getByRole("timer", { name: "Temps de repos restant" })
      .querySelector(".countdown-value"),
  ).toHaveAttribute("stroke-dashoffset", String(100 * (1 - 60 / 90)));
  expect(execution).toEqual(before);
});

it("keeps the active series identifiable outside the scrolling cards", () => {
  const workout = addExercise(createWorkout("Force"), "Squat", 2);
  render(
    <WorkoutProgress
      workout={workout}
      execution={startWorkoutExecution(workout)}
      clock={0}
      selectedExerciseId={workout.exercises[0].id}
    />,
  );
  expect(screen.getByText("Squat · Série 1 active")).toBeInTheDocument();
  expect(
    screen.getByRole("timer", { name: "Durée de la séance" }),
  ).toBeInTheDocument();
});

it("formats global session duration with hours only after sixty minutes", () => {
  expect(formatSessionDuration(8 * 60 + 7)).toBe("08:07");
  expect(formatSessionDuration(60 * 60)).toBe("1:00:00");
  expect(formatSessionDuration(-1)).toBe("00:00");
});

it("freezes completed session duration at completedAt", () => {
  const workout = addExercise(createWorkout("Force"), "Squat", 2);
  const execution = {
    ...startWorkoutExecution(workout, 1000),
    status: "completed" as const,
    completedAt: 61_000,
  };
  render(
    <WorkoutProgress
      workout={workout}
      execution={execution}
      clock={3_601_000}
      selectedExerciseId={workout.exercises[0].id}
    />,
  );
  expect(
    screen.getByRole("timer", { name: "Durée de la séance" }),
  ).toHaveTextContent("◷ 01:00");
});

it("renders a finite empty ring for a zero-second rest", () => {
  const { container } = render(
    <ActiveRestTimer remaining={0} total={0} onFinish={() => undefined} />,
  );
  expect(
    screen.getByRole("timer", { name: "Temps de repos restant" }),
  ).toHaveTextContent("0:00");
  expect(container.querySelector(".countdown-value")).toHaveAttribute(
    "stroke-dashoffset",
    "100",
  );
});
