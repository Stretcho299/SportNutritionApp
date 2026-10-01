import { describe, expect, it } from "vitest";
import {
  createCustomExercise,
  deleteCustomExercise,
  equipmentLabels,
  muscleGroupLabels,
  officialExercises,
  searchExercises,
  updateCustomExercise,
  validateCatalog,
} from "./catalog";

describe("local exercise catalog", () => {
  it("has 69 distinct, valid official definitions and the required coverage", () => {
    expect(officialExercises).toHaveLength(69);
    expect(validateCatalog(officialExercises)).toEqual([]);
    expect(new Set(officialExercises.map((exercise) => exercise.id)).size).toBe(
      69,
    );
    expect(
      new Set(officialExercises.flatMap((exercise) => exercise.muscleGroups)),
    ).toEqual(new Set(Object.keys(muscleGroupLabels)));
    expect(
      new Set(officialExercises.flatMap((exercise) => exercise.equipment)),
    ).toEqual(new Set(Object.keys(equipmentLabels)));
    expect(
      officialExercises.every((exercise) => exercise.source === "official"),
    ).toBe(true);
  });

  it("reports duplicate IDs and invalid muscle classification", () => {
    const first = officialExercises[0];
    expect(validateCatalog([first, first])).toContain(
      `ID dupliqué ou vide : ${first.id}`,
    );
    expect(validateCatalog([{ ...first, muscleGroups: [] }])).toContain(
      `Taxonomie musculaire incohérente : ${first.id}`,
    );
    expect(validateCatalog([null, { id: "official:broken" }])).toEqual(
      expect.arrayContaining([
        "Définition invalide.",
        "Alias invalides : official:broken",
        "Taxonomie musculaire absente : official:broken",
      ]),
    );
  });

  it("keeps multiple secondary targets on obvious compound movements", () => {
    const bench = officialExercises.find(
      (exercise) => exercise.id === "official:bench-press-barbell",
    );
    expect(bench?.muscleTargets).toEqual([
      { muscle: "grand_pectoral", role: "primary" },
      { muscle: "triceps", role: "secondary" },
      { muscle: "deltoide_anterieur", role: "secondary" },
    ]);
    expect(validateCatalog(officialExercises)).toEqual([]);
  });

  it("rejects repeated targets and more than one primary", () => {
    const bench = officialExercises[0];
    expect(
      validateCatalog([
        {
          ...bench,
          muscleTargets: [
            ...bench.muscleTargets,
            { muscle: "triceps", role: "secondary" },
          ],
        },
      ]),
    ).toContain(`Muscle répété : ${bench.id}`);
    expect(
      validateCatalog([
        {
          ...bench,
          muscleTargets: [
            ...bench.muscleTargets,
            { muscle: "biceps", role: "primary" },
          ],
        },
      ]),
    ).toContain(`Un seul muscle principal requis : ${bench.id}`);
  });

  it("searches names and aliases without accent or case sensitivity", () => {
    expect(
      searchExercises(officialExercises, { query: "developpe couche" }).length,
    ).toBeGreaterThan(0);
    expect(
      searchExercises(officialExercises, { query: "BENCH PRESS" }).some(
        (exercise) => exercise.id === "official:bench-press-barbell",
      ),
    ).toBe(true);
  });

  it("combines muscle and equipment filters with a query", () => {
    expect(
      searchExercises(officialExercises, { muscleGroup: "jambes" }).length,
    ).toBeGreaterThan(0);
    expect(
      searchExercises(officialExercises, { equipment: "smith" }).length,
    ).toBeGreaterThan(0);
    expect(
      searchExercises(officialExercises, {
        query: "squat",
        muscleGroup: "jambes",
        equipment: "smith",
      }).map((exercise) => exercise.id),
    ).toEqual(["official:smith-squat"]);
    expect(
      searchExercises(officialExercises, {
        query: "squat",
        muscleGroup: "pectoraux",
      }),
    ).toEqual([]);
  });
});

describe("custom exercise definitions", () => {
  it("creates a stable ID and derives UI groups from anatomical targets", () => {
    const custom = createCustomExercise({
      name: "  Mon exercice  ",
      primaryMuscle: "triceps",
      secondaryMuscles: ["grand_pectoral", "grand_pectoral"],
      equipment: ["poulie"],
    });
    expect(custom.id).toMatch(/^custom:/);
    expect(custom.name).toBe("Mon exercice");
    expect(custom.muscleGroups).toEqual(["bras", "pectoraux"]);
    expect(custom.muscleTargets).toEqual([
      { muscle: "triceps", role: "primary" },
      { muscle: "grand_pectoral", role: "secondary" },
    ]);
    expect(validateCatalog([custom])).toEqual([]);
  });

  it("rejects missing name or primary muscle", () => {
    expect(() =>
      createCustomExercise({ name: " ", primaryMuscle: "biceps" }),
    ).toThrow();
    expect(() =>
      createCustomExercise({ name: "X", primaryMuscle: "" as "biceps" }),
    ).toThrow();
  });

  it("deduplicates several custom secondaries and excludes the primary", () => {
    const custom = createCustomExercise({
      name: "Press personnel",
      primaryMuscle: "grand_pectoral",
      secondaryMuscles: [
        "triceps",
        "deltoide_anterieur",
        "triceps",
        "grand_pectoral",
      ],
    });
    expect(custom.muscleTargets).toEqual([
      { muscle: "grand_pectoral", role: "primary" },
      { muscle: "triceps", role: "secondary" },
      { muscle: "deltoide_anterieur", role: "secondary" },
    ]);
    expect(custom.muscleGroups).toEqual(["pectoraux", "bras", "epaules"]);
    expect(validateCatalog([custom])).toEqual([]);
  });

  it("preserves multiple secondaries on update and removes a new primary from them", () => {
    const custom = createCustomExercise({
      name: "Press personnel",
      primaryMuscle: "grand_pectoral",
      secondaryMuscles: ["triceps", "deltoide_anterieur"],
    });
    const renamed = updateCustomExercise(custom, { name: "Press modifié" });
    expect(renamed.muscleTargets).toEqual(custom.muscleTargets);
    const changedPrimary = updateCustomExercise(renamed, {
      primaryMuscle: "triceps",
    });
    expect(changedPrimary.muscleTargets).toEqual([
      { muscle: "triceps", role: "primary" },
      { muscle: "deltoide_anterieur", role: "secondary" },
    ]);
    expect(validateCatalog([changedPrimary])).toEqual([]);
  });

  it("updates details while preserving ID and refusing official edits", () => {
    const custom = createCustomExercise({
      name: "Ancien",
      primaryMuscle: "biceps",
    });
    const updated = updateCustomExercise(custom, {
      name: "Nouveau",
      primaryMuscle: "triceps",
      equipment: ["halteres"],
    });
    expect(updated.id).toBe(custom.id);
    expect(updated.name).toBe("Nouveau");
    expect(updated.muscleTargets[0]).toEqual({
      muscle: "triceps",
      role: "primary",
    });
    expect(updated.equipment).toEqual(["halteres"]);
    expect(() =>
      updateCustomExercise(officialExercises[0], { name: "Autre" }),
    ).toThrow();
  });

  it("deletes custom definitions and refuses official deletion", () => {
    const custom = createCustomExercise({
      name: "Mon exercice",
      primaryMuscle: "biceps",
    });
    expect(deleteCustomExercise([custom], custom.id)).toEqual([]);
    expect(() =>
      deleteCustomExercise(officialExercises, officialExercises[0].id),
    ).toThrow();
  });
});
