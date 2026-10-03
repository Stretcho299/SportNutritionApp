import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { officialExercises } from "./exercises/catalog";
import {
  addExercise,
  createWorkout,
  createWorkoutSession,
} from "./storage/database";
import type { WorkoutSession } from "./storage/database";
import { SessionSummary } from "./SessionSummary";

function makeSession(
  id: string,
  completedAt: number,
  weightKg: number | null,
  repetitions: number | null,
) {
  const definition = officialExercises.find(
    (item) => item.id === "official:bench-press-barbell",
  )!;
  let template = addExercise(
    createWorkout("Push"),
    definition.name,
    3,
    90,
    definition,
  );
  template = {
    ...template,
    exercises: template.exercises.map((exercise) => ({
      ...exercise,
      permanentNote: "Banc position 4",
    })),
  };
  const base = createWorkoutSession(template, completedAt - 3_120_000);
  const exerciseId = template.exercises[0].id;
  return {
    ...base,
    id,
    templateId: "push-template",
    templateName: "Push historique",
    completedAt,
    status: "completed" as const,
    sessionNotes: { [exerciseId]: "Très bonnes sensations" },
    execution: {
      ...base.execution,
      status: "completed" as const,
      completedAt,
      exercises: [
        {
          exerciseId,
          status: "completed" as const,
          sets: [
            {
              setId: template.exercises[0].plannedSets[0].id,
              status: "performed" as const,
              weightKg,
              repetitions,
              restSeconds: 90,
            },
            {
              setId: template.exercises[0].plannedSets[2].id,
              status: "skipped" as const,
              weightKg: 100,
              repetitions: 10,
              restSeconds: 90,
            },
          ],
        },
      ],
    },
  } satisfies WorkoutSession;
}

it("renders a read-only historical recap from its snapshot, executed sets, and notes", () => {
  const previous = makeSession("previous", 1_700_000_000_000, 70, 8);
  const session = makeSession("current", 1_700_100_000_000, 80, 8);
  const liveTemplate = {
    ...session.snapshot,
    name: "Template renommé",
    exercises: session.snapshot.exercises.map((exercise) => ({
      ...exercise,
      name: "Exercice actuel différent",
    })),
  };
  render(
    <SessionSummary
      session={session}
      sessions={[previous, session]}
      onReturn={() => undefined}
    />,
  );

  const summary = screen.getByRole("region", {
    name: "Bilan de Push historique",
  });
  expect(within(summary).getByText("Push historique")).toBeVisible();
  expect(
    within(summary).getByText("Développé couché à la barre"),
  ).toBeVisible();
  expect(within(summary).getByText("Grand pectoral · Barre")).toBeVisible();
  expect(within(summary).getByText("80 kg × 8")).toBeVisible();
  expect(within(summary).getByText("Ignorée")).toBeVisible();
  expect(within(summary).getByText("03")).toBeVisible();
  expect(within(summary).getByText("Très bonnes sensations")).toBeVisible();
  expect(within(summary).getByText("Banc position 4")).toBeVisible();
  expect(within(summary).getByText("+80 kg")).toBeVisible();
  expect(within(summary).getByText("+14,3 %")).toBeVisible();
  expect(within(summary).queryByText(/kcal/i)).toBeNull();
  expect(liveTemplate.name).toBe("Template renommé");
  expect(session.snapshot.exercises[0].name).toBe(
    "Développé couché à la barre",
  );
});

it("shows weightless performed sets as repetitions and the first-session state", () => {
  const session = makeSession("first", 1_700_100_000_000, null, 12);
  render(
    <SessionSummary
      session={session}
      sessions={[session]}
      onReturn={() => undefined}
    />,
  );
  const summary = screen.getByRole("region", {
    name: "Bilan de Push historique",
  });
  expect(within(summary).getByText("12 reps")).toBeVisible();
  expect(
    within(summary).getByText("Première séance enregistrée"),
  ).toBeVisible();
});

it("shows archived exercise details and notes from the historical snapshot", () => {
  const session = makeSession("archived", 1_700_100_000_000, 80, 8);
  const source = session.snapshot.exercises[0];
  const archived = {
    ...source,
    id: "archived-exercise",
    name: "Ancien exercice archivé",
    position: 1,
    permanentNote: "Réglage historique",
  };
  session.snapshot.exercises.push(archived);
  session.sessionNotes = {
    ...session.sessionNotes,
    [archived.id]: "Note archivée",
  };
  session.execution.archivedExercises = [
    {
      exerciseId: archived.id,
      status: "completed",
      sets: [
        {
          setId: archived.plannedSets[0].id,
          status: "performed",
          weightKg: null,
          repetitions: 6,
          restSeconds: 90,
        },
      ],
    },
  ];

  render(
    <SessionSummary
      session={session}
      sessions={[session]}
      onReturn={() => undefined}
    />,
  );

  const summary = screen.getByRole("region", {
    name: "Bilan de Push historique",
  });
  expect(within(summary).getByText("Ancien exercice archivé")).toBeVisible();
  expect(within(summary).getByText("6 reps")).toBeVisible();
  expect(within(summary).getByText("Note archivée")).toBeVisible();
  expect(within(summary).getByText("Réglage historique")).toBeVisible();
});
