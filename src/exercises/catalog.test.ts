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
