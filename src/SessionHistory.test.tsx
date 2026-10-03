import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  addExercise,
  createWorkout,
  createWorkoutSession,
} from "./storage/database";
import type { WorkoutSession } from "./storage/database";
import { SessionHistory } from "./SessionHistory";

function makeSession(
  id: string,
  status: WorkoutSession["status"],
  completedAt: number | null,
) {
  const template = addExercise(createWorkout("Push"), "Bench", 1, 60);
  const base = createWorkoutSession(template, completedAt ?? 1_000);
  return {
    ...base,
    id,
    templateName: id,
    status,
    completedAt,
    execution: {
      ...base.execution,
      status: status === "abandoned" ? "inProgress" : status,
      completedAt: completedAt ?? undefined,
    },
  } as WorkoutSession;
}

it("shows completed sessions newest first in month groups and excludes other statuses", () => {
  const october = makeSession(
    "Octobre",
    "completed",
    new Date(2026, 9, 3).getTime(),
  );
  const september = makeSession(
    "Septembre",
    "completed",
    new Date(2026, 8, 30).getTime(),
  );
  const active = makeSession("Active", "inProgress", null);
  const abandoned = makeSession("Abandonnée", "abandoned", null);
  render(
    <SessionHistory
      sessions={[september, active, abandoned, october]}
      onOpenSession={() => undefined}
    />,
  );

  const history = screen.getByRole("region", { name: "Historique" });
  expect(
    within(history).getByRole("heading", { name: "OCTOBRE 2026" }),
  ).toBeVisible();
  expect(
    within(history).getByRole("heading", { name: "SEPTEMBRE 2026" }),
  ).toBeVisible();
  const rows = within(history).getAllByRole("button");
  expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
    "Ouvrir le bilan de Octobre",
    "Ouvrir le bilan de Septembre",
  ]);
  expect(within(history).queryByText("Active")).toBeNull();
  expect(within(history).queryByText("Abandonnée")).toBeNull();
});

it("shows an explicit empty state when no completed session exists", () => {
  render(
    <SessionHistory
      sessions={[makeSession("Active", "inProgress", null)]}
      onOpenSession={() => undefined}
    />,
  );
  expect(screen.getByText("Aucune séance terminée")).toBeVisible();
  expect(
    screen.getByText("Vos séances terminées apparaîtront ici."),
  ).toBeVisible();
});
