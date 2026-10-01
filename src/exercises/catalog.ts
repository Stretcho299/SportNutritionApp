/** Local, app-owned exercise vocabulary. IDs and target slugs are persistent data. */
export const muscleGroupLabels = {
  pectoraux: "Pectoraux",
  dos: "Dos",
  epaules: "Épaules",
  bras: "Bras",
  jambes: "Jambes",
  abdominaux: "Abdominaux",
} as const;
export type MuscleGroup = keyof typeof muscleGroupLabels;

export const muscleTargetLabels = {
  grand_pectoral: "Grand pectoral",
  grand_dorsal: "Grand dorsal",
  trapezes: "Trapèzes",
  rhomboides: "Rhomboïdes",
  erectors_rachis: "Érecteurs du rachis",
  deltoide_anterieur: "Deltoïde antérieur",
  deltoide_lateral: "Deltoïde latéral",
  deltoide_posterieur: "Deltoïde postérieur",
  biceps: "Biceps",
  brachial: "Brachial",
  triceps: "Triceps",
  avant_bras: "Avant-bras",
  quadriceps: "Quadriceps",
  ischio_jambiers: "Ischio-jambiers",
  grand_fessier: "Grand fessier",
  moyen_fessier: "Moyen fessier",
  adducteurs: "Adducteurs",
  mollets: "Mollets",
  grand_droit: "Grand droit de l'abdomen",
  obliques: "Obliques",
  transverse: "Transverse",
} as const;
export type MuscleTarget = keyof typeof muscleTargetLabels;

export const muscleTargetGroup: Record<MuscleTarget, MuscleGroup> = {
  grand_pectoral: "pectoraux",
  grand_dorsal: "dos",
  trapezes: "dos",
  rhomboides: "dos",
  erectors_rachis: "dos",
  deltoide_anterieur: "epaules",
  deltoide_lateral: "epaules",
  deltoide_posterieur: "epaules",
  biceps: "bras",
  brachial: "bras",
  triceps: "bras",
  avant_bras: "bras",
  quadriceps: "jambes",
  ischio_jambiers: "jambes",
  grand_fessier: "jambes",
  moyen_fessier: "jambes",
  adducteurs: "jambes",
  mollets: "jambes",
  grand_droit: "abdominaux",
  obliques: "abdominaux",
  transverse: "abdominaux",
};

export const defaultMuscleTargetForGroup: Record<MuscleGroup, MuscleTarget> = {
  pectoraux: "grand_pectoral",
  dos: "grand_dorsal",
  epaules: "deltoide_lateral",
  bras: "biceps",
  jambes: "quadriceps",
  abdominaux: "grand_droit",
};

export const equipmentLabels = {
  barre: "Barre",
  halteres: "Haltères",
  poulie: "Poulie",
  machine: "Machine",
  smith: "Smith machine",
  poids_du_corps: "Poids du corps",
} as const;
export type Equipment = keyof typeof equipmentLabels;

export type ExerciseDefinition = {
  id: string;
  name: string;
  aliases: string[];
  category: "strength";
  measurementType: "reps" | "duration";
  mechanics: "compound" | "isolation" | null;
  force: "push" | "pull" | "static" | null;
  equipment: Equipment[];
  muscleGroups: MuscleGroup[];
  muscleTargets: { muscle: MuscleTarget; role: "primary" | "secondary" }[];
  source: "official" | "custom";
};

type OfficialRow = readonly [
  id: string,
  name: string,
  aliases: string,
  equipment: Equipment,
  primary: MuscleTarget,
  secondaries: readonly MuscleTarget[],
  mechanics?: "compound" | "isolation",
  force?: "push" | "pull" | "static",
  measurementType?: "reps" | "duration",
];

// Hand-curated French catalogue. Stable IDs never depend on names or array order.
const rows: OfficialRow[] = [
  [
    "bench-press-barbell",
    "Développé couché à la barre",
    "Bench press|Développé couché",
    "barre",
    "grand_pectoral",
    ["triceps", "deltoide_anterieur"],
    "compound",
    "push",
  ],
  [
    "bench-press-dumbbell",
    "Développé couché aux haltères",
    "Dumbbell bench press",
    "halteres",
    "grand_pectoral",
    ["triceps", "deltoide_anterieur"],
    "compound",
    "push",
  ],
  [
    "incline-press-barbell",
    "Développé incliné à la barre",
    "Incline bench press",
    "barre",
    "grand_pectoral",
    ["deltoide_anterieur", "triceps"],
    "compound",
    "push",
  ],
  [
    "incline-press-dumbbell",
    "Développé incliné aux haltères",
    "Incline dumbbell press",
    "halteres",
    "grand_pectoral",
    ["deltoide_anterieur", "triceps"],
    "compound",
    "push",
  ],
  [
    "decline-press-barbell",
    "Développé décliné à la barre",
    "Decline bench press",
    "barre",
    "grand_pectoral",
    ["triceps"],
    "compound",
    "push",
  ],
  [
    "chest-fly-dumbbell",
    "Écarté couché aux haltères",
    "Dumbbell fly",
    "halteres",
    "grand_pectoral",
    [],
    "isolation",
    "push",
  ],
  [
    "chest-fly-cable",
    "Écarté à la poulie",
    "Cable fly|Cross-over",
    "poulie",
    "grand_pectoral",
    [],
    "isolation",
    "push",
  ],
  [
    "chest-press-machine",
    "Développé pectoraux à la machine",
    "Chest press",
    "machine",
    "grand_pectoral",
    ["triceps", "deltoide_anterieur"],
    "compound",
    "push",
  ],
  [
    "bench-press-smith",
    "Développé couché à la Smith machine",
    "Smith bench press",
    "smith",
    "grand_pectoral",
    ["triceps"],
    "compound",
    "push",
  ],
  [
    "push-up",
    "Pompes",
    "Push-up|Push ups",
    "poids_du_corps",
    "grand_pectoral",
    ["triceps", "deltoide_anterieur"],
    "compound",
    "push",
  ],
  [
    "chest-dip",
    "Dips pectoraux",
    "Chest dips",
    "poids_du_corps",
    "grand_pectoral",
    ["triceps"],
    "compound",
    "push",
  ],
  [
    "pull-up",
    "Tractions en pronation",
    "Pull-up|Tractions",
    "poids_du_corps",
    "grand_dorsal",
    ["biceps", "rhomboides"],
    "compound",
    "pull",
  ],
  [
    "chin-up",
    "Tractions en supination",
    "Chin-up",
    "poids_du_corps",
    "grand_dorsal",
    ["biceps"],
    "compound",
    "pull",
  ],
  [
    "lat-pulldown",
    "Tirage vertical à la poulie",
    "Lat pulldown",
    "poulie",
    "grand_dorsal",
    ["biceps"],
    "compound",
    "pull",
  ],
  [
    "seated-row-cable",
    "Tirage horizontal à la poulie",
    "Seated cable row",
    "poulie",
    "grand_dorsal",
    ["rhomboides"],
    "compound",
    "pull",
  ],
  [
    "barbell-row",
    "Rowing à la barre",
    "Barbell row",
    "barre",
    "grand_dorsal",
    ["rhomboides", "biceps"],
    "compound",
    "pull",
  ],
  [
    "dumbbell-row",
    "Rowing unilatéral aux haltères",
    "One-arm dumbbell row",
    "halteres",
    "grand_dorsal",
    ["biceps"],
    "compound",
    "pull",
  ],
  [
    "tbar-row-machine",
    "Rowing T-bar à la machine",
    "T-bar row",
    "machine",
    "grand_dorsal",
    ["rhomboides"],
    "compound",
    "pull",
  ],
  [
    "pullover-cable",
    "Pull-over à la poulie",
    "Straight-arm pulldown",
    "poulie",
    "grand_dorsal",
    [],
    "isolation",
    "pull",
  ],
  [
    "back-extension",
    "Extensions lombaires",
    "Back extension",
    "poids_du_corps",
    "erectors_rachis",
    ["grand_fessier"],
    "compound",
    "pull",
  ],
  [
    "shrug-dumbbell",
    "Haussements d'épaules aux haltères",
    "Dumbbell shrug",
    "halteres",
    "trapezes",
    [],
    "isolation",
    "pull",
  ],
  [
    "overhead-press-barbell",
    "Développé militaire à la barre",
    "Overhead press|Military press",
    "barre",
    "deltoide_anterieur",
    ["triceps", "deltoide_lateral"],
    "compound",
    "push",
  ],
  [
    "overhead-press-dumbbell",
    "Développé épaules aux haltères",
    "Dumbbell shoulder press",
    "halteres",
    "deltoide_anterieur",
    ["triceps"],
    "compound",
    "push",
  ],
  [
    "shoulder-press-machine",
    "Développé épaules à la machine",
    "Machine shoulder press",
    "machine",
    "deltoide_anterieur",
    ["triceps"],
    "compound",
    "push",
  ],
  [
    "lateral-raise-dumbbell",
    "Élévations latérales aux haltères",
    "Lateral raise",
    "halteres",
    "deltoide_lateral",
    [],
    "isolation",
    "push",
  ],
  [
    "lateral-raise-cable",
    "Élévations latérales à la poulie",
    "Cable lateral raise",
    "poulie",
    "deltoide_lateral",
    [],
    "isolation",
    "push",
  ],
  [
    "front-raise-dumbbell",
    "Élévations frontales aux haltères",
    "Front raise",
    "halteres",
    "deltoide_anterieur",
    [],
    "isolation",
    "push",
  ],
  [
    "reverse-fly-dumbbell",
    "Oiseau aux haltères",
    "Rear delt fly",
    "halteres",
    "deltoide_posterieur",
    ["rhomboides"],
    "isolation",
    "pull",
  ],
  [
    "face-pull",
    "Face pull à la poulie",
    "Face pull",
    "poulie",
    "deltoide_posterieur",
    ["trapezes"],
    "compound",
    "pull",
  ],
  [
    "reverse-pec-deck",
    "Oiseau à la machine",
    "Reverse pec deck",
    "machine",
    "deltoide_posterieur",
    ["rhomboides"],
    "isolation",
    "pull",
  ],
  [
    "biceps-curl-barbell",
    "Curl biceps à la barre",
    "Barbell curl",
    "barre",
    "biceps",
    [],
    "isolation",
    "pull",
  ],
  [
    "biceps-curl-dumbbell",
    "Curl biceps aux haltères",
    "Dumbbell curl",
    "halteres",
    "biceps",
    [],
    "isolation",
    "pull",
  ],
  [
    "hammer-curl",
    "Curl marteau",
    "Hammer curl",
    "halteres",
    "brachial",
    ["biceps"],
    "isolation",
    "pull",
  ],
  [
    "preacher-curl",
    "Curl pupitre à la machine",
    "Preacher curl",
    "machine",
    "biceps",
    [],
    "isolation",
    "pull",
  ],
  [
    "cable-curl",
    "Curl biceps à la poulie",
    "Cable curl",
    "poulie",
    "biceps",
    [],
    "isolation",
    "pull",
  ],
  [
    "concentration-curl",
    "Curl concentration",
    "Concentration curl",
    "halteres",
    "biceps",
    [],
    "isolation",
    "pull",
  ],
  [
    "triceps-pushdown",
    "Extension triceps à la poulie",
    "Triceps pushdown",
    "poulie",
    "triceps",
    [],
    "isolation",
    "push",
  ],
  [
    "overhead-triceps-cable",
    "Extension triceps au-dessus de la tête à la poulie",
    "Overhead cable triceps extension",
    "poulie",
    "triceps",
    [],
    "isolation",
    "push",
  ],
  [
    "skull-crusher",
    "Barre au front",
    "Skull crusher|French press",
    "barre",
    "triceps",
    [],
    "isolation",
    "push",
  ],
  [
    "triceps-kickback",
    "Extension triceps en arrière aux haltères",
    "Triceps kickback",
    "halteres",
    "triceps",
    [],
    "isolation",
    "push",
  ],
  [
    "close-grip-bench",
    "Développé couché prise serrée",
    "Close-grip bench press",
    "barre",
    "triceps",
    ["grand_pectoral"],
    "compound",
    "push",
  ],
  [
    "triceps-dip",
    "Dips triceps",
    "Triceps dips",
    "poids_du_corps",
    "triceps",
    ["grand_pectoral"],
    "compound",
    "push",
  ],
  [
    "squat-barbell",
    "Squat à la barre",
    "Back squat|Squat",
    "barre",
    "quadriceps",
    ["grand_fessier", "adducteurs"],
    "compound",
    "push",
  ],
  [
    "front-squat",
    "Squat avant à la barre",
    "Front squat",
    "barre",
    "quadriceps",
    ["grand_fessier"],
    "compound",
    "push",
  ],
  [
    "goblet-squat",
    "Goblet squat",
    "Squat gobelet",
    "halteres",
    "quadriceps",
    ["grand_fessier"],
    "compound",
    "push",
  ],
  [
    "smith-squat",
    "Squat à la Smith machine",
    "Smith squat",
    "smith",
    "quadriceps",
    ["grand_fessier"],
    "compound",
    "push",
  ],
  [
    "leg-press",
    "Presse à cuisses",
    "Leg press",
    "machine",
    "quadriceps",
    ["grand_fessier"],
    "compound",
    "push",
  ],
  [
    "leg-extension",
    "Extension des jambes à la machine",
    "Leg extension",
    "machine",
    "quadriceps",
    [],
    "isolation",
    "push",
  ],
  [
    "walking-lunge",
    "Fentes marchées aux haltères",
    "Walking lunges",
    "halteres",
    "quadriceps",
    ["grand_fessier"],
    "compound",
    "push",
  ],
  [
    "bulgarian-split-squat",
    "Squat bulgare aux haltères",
    "Bulgarian split squat",
    "halteres",
    "quadriceps",
    ["grand_fessier"],
    "compound",
    "push",
  ],
  [
    "romanian-deadlift",
    "Soulevé de terre roumain à la barre",
    "Romanian deadlift|RDL",
    "barre",
    "ischio_jambiers",
    ["grand_fessier", "erectors_rachis"],
    "compound",
    "pull",
  ],
  [
    "romanian-deadlift-dumbbell",
    "Soulevé de terre roumain aux haltères",
    "Dumbbell Romanian deadlift",
    "halteres",
    "ischio_jambiers",
    ["grand_fessier"],
    "compound",
    "pull",
  ],
  [
    "deadlift",
    "Soulevé de terre conventionnel",
    "Deadlift",
    "barre",
    "grand_fessier",
    ["ischio_jambiers", "erectors_rachis"],
    "compound",
    "pull",
  ],
  [
    "leg-curl-lying",
    "Leg curl allongé",
    "Lying leg curl",
    "machine",
    "ischio_jambiers",
    [],
    "isolation",
    "pull",
  ],
  [
    "leg-curl-seated",
    "Leg curl assis",
    "Seated leg curl",
    "machine",
    "ischio_jambiers",
    [],
    "isolation",
    "pull",
  ],
  [
    "hip-thrust-barbell",
    "Hip thrust à la barre",
    "Barbell hip thrust",
    "barre",
    "grand_fessier",
    ["ischio_jambiers"],
    "compound",
    "push",
  ],
  [
    "hip-thrust-smith",
    "Hip thrust à la Smith machine",
    "Smith hip thrust",
    "smith",
    "grand_fessier",
    ["ischio_jambiers"],
    "compound",
    "push",
  ],
  [
    "glute-bridge",
    "Pont fessier au poids du corps",
    "Glute bridge",
    "poids_du_corps",
    "grand_fessier",
    ["ischio_jambiers"],
    "compound",
    "push",
  ],
  [
    "cable-kickback",
    "Extension de hanche à la poulie",
    "Cable glute kickback",
    "poulie",
    "grand_fessier",
    [],
    "isolation",
    "push",
  ],
  [
    "hip-abduction-machine",
    "Abduction de hanche à la machine",
    "Hip abduction",
    "machine",
    "moyen_fessier",
    [],
    "isolation",
    "push",
  ],
  [
    "hip-adduction-machine",
    "Adduction de hanche à la machine",
    "Hip adduction",
    "machine",
    "adducteurs",
    [],
    "isolation",
    "pull",
  ],
  [
    "calf-raise-standing",
    "Extensions mollets debout à la machine",
    "Standing calf raise",
    "machine",
    "mollets",
    [],
    "isolation",
    "push",
  ],
  [
    "calf-raise-seated",
    "Extensions mollets assis à la machine",
    "Seated calf raise",
    "machine",
    "mollets",
    [],
    "isolation",
    "push",
  ],
  [
    "calf-raise-dumbbell",
    "Extensions mollets aux haltères",
    "Dumbbell calf raise",
    "halteres",
    "mollets",
    [],
    "isolation",
    "push",
  ],
  [
    "crunch",
    "Crunch au sol",
    "Crunch",
    "poids_du_corps",
    "grand_droit",
    [],
    "isolation",
    "static",
  ],
  [
    "cable-crunch",
    "Crunch à la poulie",
    "Cable crunch",
    "poulie",
    "grand_droit",
    [],
    "isolation",
    "static",
  ],
  [
    "leg-raise",
    "Relevé de jambes suspendu",
    "Hanging leg raise",
    "poids_du_corps",
    "grand_droit",
    ["obliques"],
    "compound",
    "static",
  ],
  [
    "reverse-crunch",
    "Crunch inversé",
    "Reverse crunch",
    "poids_du_corps",
    "grand_droit",
    [],
    "isolation",
    "static",
  ],
  [
    "russian-twist",
    "Rotations russes",
    "Russian twist",
    "poids_du_corps",
    "obliques",
    ["grand_droit"],
    "compound",
    "static",
  ],
];

export const officialExercises: ExerciseDefinition[] = rows.map(
  ([
    id,
    name,
    aliases,
    equipment,
    primary,
    secondaries,
    mechanics,
    force,
    measurementType,
  ]) => {
    const targets: ExerciseDefinition["muscleTargets"] = [
      { muscle: primary, role: "primary" },
      ...secondaries.map((muscle) => ({ muscle, role: "secondary" as const })),
    ];
    return {
      id: `official:${id}`,
      name,
      aliases: aliases ? aliases.split("|") : [],
      category: "strength",
      measurementType: measurementType ?? "reps",
      mechanics: mechanics ?? null,
      force: force ?? null,
      equipment: [equipment],
      muscleGroups: [
        ...new Set(targets.map(({ muscle }) => muscleTargetGroup[muscle])),
      ],
      muscleTargets: targets,
      source: "official",
    };
  },
);

export type ExerciseSearch = {
  query?: string;
  muscleGroup?: MuscleGroup | null;
  equipment?: Equipment | null;
};
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim();

export function searchExercises(
  definitions: readonly ExerciseDefinition[],
  { query = "", muscleGroup, equipment }: ExerciseSearch = {},
): ExerciseDefinition[] {
  const needle = normalize(query);
  return definitions.filter(
    (definition) =>
      (!needle ||
        [definition.name, ...definition.aliases].some((text) =>
          normalize(text).includes(needle),
        )) &&
      (!muscleGroup || definition.muscleGroups.includes(muscleGroup)) &&
      (!equipment || definition.equipment.includes(equipment)),
  );
}

export function validateCatalog(definitions: readonly unknown[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const raw of definitions) {
    if (!raw || typeof raw !== "object") {
      errors.push("Définition invalide.");
      continue;
    }
    const definition = raw as Partial<ExerciseDefinition>;
    const id = typeof definition.id === "string" ? definition.id : "";
    if (!id || ids.has(id)) errors.push(`ID dupliqué ou vide : ${id}`);
    ids.add(id);
    if (typeof definition.name !== "string" || !definition.name.trim())
      errors.push(`Nom vide : ${id}`);
    if (
      !Array.isArray(definition.aliases) ||
      definition.aliases.some((alias) => typeof alias !== "string")
    )
      errors.push(`Alias invalides : ${id}`);
    if (
      definition.category !== "strength" ||
      !["reps", "duration"].includes(definition.measurementType ?? "")
    )
      errors.push(`Type d'exercice invalide : ${id}`);
    if (
      ![null, "compound", "isolation"].includes(definition.mechanics ?? null) ||
      ![null, "push", "pull", "static"].includes(definition.force ?? null)
    )
      errors.push(`Mécanique ou force invalide : ${id}`);
    if (
      !Array.isArray(definition.muscleTargets) ||
      !Array.isArray(definition.muscleGroups)
    ) {
      errors.push(`Taxonomie musculaire absente : ${id}`);
      continue;
    }
    if (
      definition.muscleTargets.filter((target) => target?.role === "primary")
        .length !== 1
    )
      errors.push(`Un seul muscle principal requis : ${id}`);
    if (
      new Set(definition.muscleTargets.map((target) => target?.muscle)).size !==
      definition.muscleTargets.length
    )
      errors.push(`Muscle répété : ${id}`);
    if (definition.muscleGroups.some((group) => !(group in muscleGroupLabels)))
      errors.push(`Groupe musculaire invalide : ${id}`);
    for (const target of definition.muscleTargets) {
      if (
        !target ||
        !["primary", "secondary"].includes(target.role) ||
        !(target.muscle in muscleTargetGroup) ||
        !definition.muscleGroups.includes(muscleTargetGroup[target.muscle])
      )
        errors.push(`Taxonomie musculaire incohérente : ${id}`);
    }
    if (
      !Array.isArray(definition.equipment) ||
      new Set(definition.equipment).size !== definition.equipment.length ||
      definition.equipment.some((item) => !(item in equipmentLabels))
    )
      errors.push(`Matériel invalide : ${id}`);
    if (definition.source === "official" && !id.startsWith("official:"))
      errors.push(`ID officiel invalide : ${id}`);
    if (definition.source === "custom" && !id.startsWith("custom:"))
      errors.push(`ID personnalisé invalide : ${id}`);
    if (definition.source !== "custom" && definition.source !== "official")
      errors.push(`Source invalide : ${id}`);
  }
  return errors;
}

export type CustomExerciseInput = {
  name: string;
  primaryMuscle: MuscleTarget;
  secondaryMuscles?: MuscleTarget[];
  equipment?: Equipment[];
  aliases?: string[];
};

function customFields(input: CustomExerciseInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Le nom est obligatoire.");
  if (!(input.primaryMuscle in muscleTargetGroup))
    throw new Error("Le muscle principal est obligatoire.");
  const secondaryMuscles = [...new Set(input.secondaryMuscles ?? [])].filter(
    (muscle) => muscle !== input.primaryMuscle,
  );
  if (secondaryMuscles.some((muscle) => !(muscle in muscleTargetGroup)))
    throw new Error("Muscle secondaire invalide.");
  const equipment = [...new Set(input.equipment ?? [])];
  if (equipment.some((item) => !(item in equipmentLabels)))
    throw new Error("Matériel invalide.");
  const targets: ExerciseDefinition["muscleTargets"] = [
    { muscle: input.primaryMuscle, role: "primary" },
    ...secondaryMuscles.map((muscle) => ({
      muscle,
      role: "secondary" as const,
    })),
  ];
  return {
    name,
    aliases: [
      ...new Set(
        (input.aliases ?? []).map((alias) => alias.trim()).filter(Boolean),
      ),
    ],
    equipment,
    muscleGroups: [
      ...new Set(targets.map(({ muscle }) => muscleTargetGroup[muscle])),
    ],
    muscleTargets: targets,
  };
}

export function createCustomExercise(
  input: CustomExerciseInput,
  existing: readonly ExerciseDefinition[] = [],
): ExerciseDefinition {
  let id: string;
  do {
    id = `custom:${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  } while (existing.some((definition) => definition.id === id));
  return {
    id,
    ...customFields(input),
    category: "strength",
    measurementType: "reps",
    mechanics: null,
    force: null,
    source: "custom",
  };
}

export function updateCustomExercise(
  definition: ExerciseDefinition,
  patch: Partial<CustomExerciseInput>,
): ExerciseDefinition {
  if (definition.source !== "custom")
    throw new Error("Un exercice officiel ne peut pas être modifié.");
  const primaryMuscle = definition.muscleTargets.find(
    (target) => target.role === "primary",
  )?.muscle;
  if (!primaryMuscle) throw new Error("Muscle principal manquant.");
  return {
    ...definition,
    ...customFields({
      name: patch.name ?? definition.name,
      primaryMuscle: patch.primaryMuscle ?? primaryMuscle,
      secondaryMuscles:
        patch.secondaryMuscles ??
        definition.muscleTargets
          .filter((target) => target.role === "secondary")
          .map((target) => target.muscle),
      equipment: patch.equipment ?? definition.equipment,
      aliases: patch.aliases ?? definition.aliases,
    }),
  };
}

export function deleteCustomExercise(
  definitions: readonly ExerciseDefinition[],
  id: string,
): ExerciseDefinition[] {
  if (
    id.startsWith("official:") ||
    definitions.some(
      (definition) => definition.id === id && definition.source === "official",
    )
  )
    throw new Error("Un exercice officiel ne peut pas être supprimé.");
  return definitions.filter((definition) => definition.id !== id);
}
