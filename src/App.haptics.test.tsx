import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "./App";
import * as database from "./storage/database";

const vibrate = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vibrate.mockReset();
  vi.stubGlobal("navigator", { vibrate });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function openWorkout(
  count = 2,
  active = false,
  expired = false,
  secondExercise = false,
  restSeconds = 3,
) {
  let workout = database.addExercise(
    database.createWorkout("Haptics"),
    "Squat",
    count,
    restSeconds,
  );
  if (secondExercise) workout = database.addExercise(workout, "Row", 1, 3);
  let execution = active
    ? database.createWorkoutSession(workout).execution
    : undefined;
  if (expired && execution) {
    execution = database.startExecutedSetRest(
      execution,
      workout.exercises[0].id,
      workout.exercises[0].plannedSets[0].id,
      Date.now() - 60_000,
    );
  }
  localStorage.setItem(
    database.__storageKey,
    JSON.stringify([{ ...workout, execution }]),
  );
  const view = render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Ouvrir Mes séances" }),
  );
  fireEvent.click((await screen.findByText("Haptics")).closest("button")!);
  return view;
}

const execution = () =>
  JSON.parse(localStorage.getItem(database.__storageKey)!).sessions[0]
    .execution;
const start = () =>
  fireEvent.click(screen.getByRole("button", { name: "Démarrer la séance" }));
const rest = () =>
  fireEvent.click(
    screen.getAllByRole("button", { name: "Lancer le repos" })[0],
  );
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}
async function confirm(name: string) {
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name,
    }),
  );
  await advance(180);
}

it("only signals an actual new start, never detail display or resuming", async () => {
  await openWorkout();
  expect(vibrate).not.toHaveBeenCalled();
  start();
  expect(vibrate.mock.calls).toEqual([[20]]);
  const sessionId = execution().sessionId;
  fireEvent.click(screen.getByRole("button", { name: "Retour aux séances" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Reprendre la séance Haptics" }),
  );
  expect(execution().sessionId).toBe(sessionId);
  expect(vibrate.mock.calls).toEqual([[20]]);
});

it("resumes a persisted session without start feedback", async () => {
  await openWorkout(2, true);
  expect(vibrate).not.toHaveBeenCalled();
});

it("signals one natural expiration and performed transition, with no tick/resync duplicates", async () => {
  const view = await openWorkout();
  vi.useFakeTimers();
  start();
  vibrate.mockClear();
  rest();
  expect(vibrate).not.toHaveBeenCalled();
  await advance(3000);
  expect(execution().exercises[0].sets[0].status).toBe("performed");
  expect(vibrate.mock.calls).toEqual([[20]]);
  fireEvent(window, new Event("pageshow"));
  fireEvent(window, new Event("focus"));
  fireEvent(document, new Event("visibilitychange"));
  view.rerender(<App />);
  await advance(5000);
  expect(vibrate.mock.calls).toEqual([[20]]);
});

it("keeps manual rest termination silent, including its confirmation", async () => {
  await openWorkout();
  vi.useFakeTimers();
  start();
  rest();
  vibrate.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Mettre fin au repos" }));
  expect(vibrate).not.toHaveBeenCalled();
  await confirm("Mettre fin");
  expect(execution().exercises[0].sets[0].status).toBe("performed");
  await advance(5000);
  expect(vibrate).not.toHaveBeenCalled();
});

it("replaces set light with exercise medium for the final set action", async () => {
  const view = await openWorkout(1);
  vi.useFakeTimers();
  start();
  vibrate.mockClear();
  rest();
  expect(execution().exercises[0]).toMatchObject({
    status: "completed",
    sets: [{ status: "performed" }],
  });
  expect(vibrate.mock.calls).toEqual([[50]]);
  view.rerender(<App />);
  await advance(2000);
  expect(vibrate.mock.calls).toEqual([[50]]);
});

it("signals confirmation then success only after completion is persisted", async () => {
  await openWorkout(1);
  vi.useFakeTimers();
  start();
  rest();
  vibrate.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Terminer la séance" }));
  expect(vibrate.mock.calls).toEqual([[50]]);
  let resolveSave!: () => void;
  const save = vi.spyOn(database, "saveWorkouts").mockReturnValueOnce(
    new Promise<void>((resolve) => {
      resolveSave = resolve;
    }),
  );
  await confirm("Terminer");
  expect(save.mock.calls[0][0][0].execution?.status).toBe("completed");
  expect(vibrate.mock.calls).toEqual([[50]]);
  await act(async () => resolveSave());
  expect(vibrate.mock.calls).toEqual([[50], [[25, 35, 45]]]);
});

it("does not signal success when completion persistence fails", async () => {
  await openWorkout(1);
  vi.useFakeTimers();
  start();
  rest();
  vibrate.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Terminer la séance" }));
  vi.spyOn(database, "saveWorkouts").mockRejectedValueOnce(
    new Error("Storage unavailable"),
  );
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await confirm("Terminer");
  expect(vibrate.mock.calls).toEqual([[50]]);
  expect(error).toHaveBeenCalledExactlyOnceWith(
    "Impossible de sauvegarder la fin de séance",
    expect.any(Error),
  );
});

it("silently settles a rest that had expired before reload", async () => {
  await openWorkout(2, true, true);
  expect(execution().exercises[0].sets[0].status).toBe("performed");
  expect(vibrate).not.toHaveBeenCalled();
});

it.each(["visibilitychange", "pageshow", "focus"])(
  "does not catch up feedback after %s on returning past expiry",
  async (event) => {
    await openWorkout();
    vi.useFakeTimers();
    start();
    rest();
    vibrate.mockClear();
    vi.setSystemTime(Date.now() + 60_000);
    fireEvent(
      event === "visibilitychange" ? document : window,
      new Event(event),
    );
    await advance(1000);
    expect(execution().exercises[0].sets[0].status).toBe("performed");
    expect(vibrate).not.toHaveBeenCalled();
  },
);

it("suppresses delayed callbacks even without a lifecycle event", async () => {
  await openWorkout();
  vi.useFakeTimers();
  start();
  rest();
  vibrate.mockClear();
  vi.setSystemTime(Date.now() + 60_000);
  await advance(1000);
  expect(execution().exercises[0].sets[0].status).toBe("performed");
  expect(vibrate).not.toHaveBeenCalled();
});

it("settles a hidden timer without vibration or later replay", async () => {
  await openWorkout();
  vi.useFakeTimers();
  start();
  rest();
  vibrate.mockClear();
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  await advance(3000);
  expect(execution().exercises[0].sets[0].status).toBe("performed");
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  await advance(3000);
  expect(vibrate).not.toHaveBeenCalled();
});

it("keeps natural rest light even when it also completes the exercise", async () => {
  await openWorkout(1, false, false, true);
  vi.useFakeTimers();
  start();
  rest();
  vibrate.mockClear();
  await advance(3000);
  expect(execution().exercises[0].status).toBe("completed");
  expect(vibrate.mock.calls).toEqual([[20]]);
  fireEvent.click(
    within(screen.getByRole("list", { name: "Exercices" })).getByRole(
      "button",
      { name: /^Row/ },
    ),
  );
  expect(vibrate.mock.calls).toEqual([[20]]);
});

it("keeps manual rest silent even when it also completes the exercise", async () => {
  await openWorkout(1, false, false, true);
  vi.useFakeTimers();
  start();
  rest();
  vibrate.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Mettre fin au repos" }));
  await confirm("Mettre fin");
  expect(execution().exercises[0].status).toBe("completed");
  expect(vibrate).not.toHaveBeenCalled();
});

it("announces explicit exercise termination at the dialog with no second confirm pulse", async () => {
  await openWorkout();
  vi.useFakeTimers();
  start();
  vibrate.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Terminer l’exercice" }));
  expect(vibrate.mock.calls).toEqual([[50]]);
  await confirm("Mettre fin");
  expect(execution().exercises[0].status).toBe("completed");
  expect(vibrate.mock.calls).toEqual([[50]]);
});

it("rearms before a future deadline after a short foreground return", async () => {
  await openWorkout();
  vi.useFakeTimers();
  start();
  rest();
  vibrate.mockClear();
  fireEvent(window, new Event("pageshow"));
  await advance(3000);
  expect(vibrate.mock.calls).toEqual([[20]]);
});

it("signals a freshly requested zero-second rest once, without replay on resync", async () => {
  await openWorkout(2, false, false, false, 0);
  vi.useFakeTimers();
  start();
  vibrate.mockClear();
  rest();
  expect(execution().exercises[0].sets[0].status).toBe("performed");
  expect(vibrate.mock.calls).toEqual([[20]]);
  fireEvent(window, new Event("pageshow"));
  await advance(3000);
  expect(vibrate.mock.calls).toEqual([[20]]);
});
