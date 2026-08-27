"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { extractYoutubeId } from "@/lib/youtube";

async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("FORBIDDEN");
  return user;
}

// ---------- Exercise Library ----------

const exerciseSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  instructions: z.string().optional().default(""),
  youtubeUrl: z.string().optional().default(""),
  muscleGroup: z.string().optional().default(""),
  equipment: z.string().optional().default(""),
  movementStandard: z.string().optional().default(""),
  tips: z.string().optional().default(""),
  status: z.enum(["draft", "published", "archived"]).default("published"),
});

export async function saveExerciseAction(formData: FormData) {
  await requireAdmin();
  const parsed = exerciseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const youtubeVideoId = d.youtubeUrl ? extractYoutubeId(d.youtubeUrl) : null;
  if (d.youtubeUrl && !youtubeVideoId) {
    return { error: "Could not parse a YouTube video ID from that URL" };
  }

  const data = {
    name: d.name,
    instructions: d.instructions,
    youtubeVideoId,
    muscleGroup: d.muscleGroup || null,
    equipment: d.equipment || null,
    movementStandard: d.movementStandard || null,
    tips: d.tips || null,
    status: d.status,
  };

  if (d.id) await prisma.exerciseLibrary.update({ where: { id: d.id }, data });
  else await prisma.exerciseLibrary.create({ data });
  revalidatePath("/admin/exercises");
  redirect("/admin/exercises");
}

// ---------- Reference-lift catalogue (CRUD) ----------

const refInput = z.object({
  name: z.string().min(1, "Name is required").max(60),
  description: z.string().max(200).optional().default(""),
  unit: z.enum(["kg", "lb"]).default("kg"),
});

export type RefLiftResult =
  | { ok: true; lift: { id: string; name: string; description: string; unit: string; status: string } }
  | { ok: false; error: string };

export async function createReferenceLift(input: unknown): Promise<RefLiftResult> {
  await requireAdmin();
  const parsed = refInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const lift = await prisma.referenceLift.create({ data: parsed.data });
  revalidatePath("/admin/reference-lifts");
  return { ok: true, lift };
}

export async function updateReferenceLift(input: unknown): Promise<RefLiftResult> {
  await requireAdmin();
  const parsed = refInput.extend({ id: z.string() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...data } = parsed.data;
  const lift = await prisma.referenceLift.update({ where: { id }, data });
  revalidatePath("/admin/reference-lifts");
  return { ok: true, lift };
}

/**
 * Show/hide a workout on the athlete-facing Workouts tab. "published" is visible,
 * "draft" is hidden. Only flips the status — sets and history are untouched.
 */
export async function setWorkoutStatus(id: string, status: "published" | "draft") {
  await requireAdmin();
  await prisma.workout.update({ where: { id }, data: { status } });
  revalidatePath("/admin/workouts");
  revalidatePath("/workouts");
  return { ok: true as const, status };
}

export async function setReferenceLiftStatus(id: string, status: "active" | "archived") {
  await requireAdmin();
  await prisma.referenceLift.update({ where: { id }, data: { status } });
  revalidatePath("/admin/reference-lifts");
  return { ok: true as const };
}

/** Hard-delete only if unused; otherwise soft-archive (guarded deletion). */
export async function deleteReferenceLift(
  id: string
): Promise<{ ok: true; archived: boolean }> {
  await requireAdmin();
  const [links, parts, userValues] = await Promise.all([
    prisma.workoutReferenceLift.count({ where: { referenceLiftId: id } }),
    prisma.workoutSetPart.count({ where: { referenceLiftId: id } }),
    prisma.userReferenceLift.count({ where: { referenceLiftId: id } }),
  ]);
  if (links + parts + userValues > 0) {
    await prisma.referenceLift.update({ where: { id }, data: { status: "archived" } });
    revalidatePath("/admin/reference-lifts");
    return { ok: true, archived: true };
  }
  await prisma.referenceLift.delete({ where: { id } });
  revalidatePath("/admin/reference-lifts");
  return { ok: true, archived: false };
}

// ---------- Workout builder (full replace save) ----------

const difficultyTriple = z.object({
  easy: z.number(),
  hard: z.number(),
  brutal: z.number(),
});

const builderSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  instructions: z.string().default(""),
  roundingIncrementKg: z.number().positive().default(2.5),
  status: z.enum(["draft", "published"]).default("draft"),
  categoryId: z.string().min(1, "Pick a category"),
  backgroundImagePath: z.string().nullable().optional(),
  referenceLiftIds: z.array(z.string()),
  rankTiers: z.array(
    z.object({ name: z.string().min(1), icon: z.string().default("🏅"), minPoints: z.number().int().min(0) })
  ),
  sets: z.array(
    z.object({
      label: z.string().optional().default(""),
      instructions: z.string().optional().default(""),
      points: difficultyTriple,
      parts: z.array(
        z.object({
          exerciseId: z.string().min(1),
          label: z.string().optional().default(""),
          referenceLiftId: z.string().min(1),
          reps: z.string().optional().default(""),
          description: z.string().default(""),
          percentages: difficultyTriple,
          repsByDifficulty: z.object({ easy: z.string(), hard: z.string(), brutal: z.string() }).optional(),
        })
      ),
    })
  ),
});

export type BuilderPayload = z.infer<typeof builderSchema>;

const DIFFS = ["easy", "hard", "brutal"] as const;

export async function saveWorkoutAction(
  payload: BuilderPayload
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = builderSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  // Structural validation for both draft (light) and publish (strict).
  for (let i = 0; i < d.sets.length; i++) {
    const s = d.sets[i];
    if (s.parts.length === 0) return { ok: false, error: `Set ${i + 1} needs at least one part` };
    for (const part of s.parts) {
      if (!d.referenceLiftIds.includes(part.referenceLiftId)) {
        return { ok: false, error: `Set ${i + 1}: a part uses a reference lift not in this workout's required list` };
      }
    }
  }

  if (d.status === "published") {
    if (d.referenceLiftIds.length === 0)
      return { ok: false, error: "Add at least one required reference lift before publishing" };
    if (d.sets.length === 0) return { ok: false, error: "Add at least one set before publishing" };
    if (d.rankTiers.length === 0) return { ok: false, error: "Add at least one rank tier before publishing" };
    if (!d.rankTiers.some((t) => t.minPoints === 0))
      return { ok: false, error: "Add an entry rank tier with 0 minimum points" };
  }

  const workoutId = await prisma.$transaction(async (tx) => {
    const base = {
      title: d.title,
      instructions: d.instructions,
      roundingIncrementKg: d.roundingIncrementKg,
      status: d.status,
      categoryId: d.categoryId,
      backgroundImagePath: d.backgroundImagePath ?? null,
    };

    let id = d.id;
    if (id) {
      await tx.workout.update({ where: { id }, data: base });
      await tx.workoutReferenceLift.deleteMany({ where: { workoutId: id } });
      await tx.workoutRankTier.deleteMany({ where: { workoutId: id } });
      await tx.workoutSet.deleteMany({ where: { workoutId: id } }); // cascades parts/percentages/points
    } else {
      const created = await tx.workout.create({ data: base });
      id = created.id;
    }

    await tx.workoutReferenceLift.createMany({
      data: d.referenceLiftIds.map((rid, i) => ({ workoutId: id!, referenceLiftId: rid, displayOrder: i })),
    });

    await tx.workoutRankTier.createMany({
      data: d.rankTiers.map((t, i) => ({
        workoutId: id!,
        name: t.name,
        icon: t.icon,
        minPoints: t.minPoints,
        displayOrder: i,
      })),
    });

    // One nested write per set (set + points + parts + percentages). Doing a
    // separate create per part meant ~2 round-trips per set, which pushed larger
    // workouts past the interactive-transaction timeout over the connection pooler.
    for (let si = 0; si < d.sets.length; si++) {
      const set = d.sets[si];
      await tx.workoutSet.create({
        data: {
          workoutId: id!,
          setOrder: si,
          label: set.label || null,
          instructions: set.instructions || null,
          points: { create: DIFFS.map((diff) => ({ difficulty: diff, points: Math.round(set.points[diff]) })) },
          parts: {
            create: set.parts.map((part, pi) => ({
              partOrder: pi,
              exerciseId: part.exerciseId,
              label: part.label?.trim() || null,
              referenceLiftId: part.referenceLiftId,
              reps: part.reps?.trim() || null,
              description: part.description,
              percentages: {
                create: DIFFS.map((diff) => ({
                  difficulty: diff,
                  percentage: part.percentages[diff],
                  reps: part.repsByDifficulty?.[diff]?.trim() || null,
                })),
              },
            })),
          },
        },
      });
    }

    return id!;
  },
  // Headroom for big workouts on a remote database: the default 5s is too tight.
  { timeout: 30_000, maxWait: 15_000 });

  revalidatePath("/admin/workouts");
  revalidatePath("/workouts");
  return { ok: true, id: workoutId };
}
