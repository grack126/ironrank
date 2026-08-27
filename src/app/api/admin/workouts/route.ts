import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiAdmin } from "@/lib/api-auth";

const DIFFS = ["easy", "hard", "brutal"] as const;

// GET: all workouts for the admin list, plus the builder option sources
// (exercises, active reference lifts, active categories).
export async function GET(req: Request) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const [workouts, exercises, referenceLifts, categories] = await Promise.all([
    prisma.workout.findMany({
      include: { _count: { select: { sets: true } }, category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.exerciseLibrary.findMany({ where: { status: { not: "archived" } }, orderBy: { name: "asc" }, select: { id: true, name: true, youtubeVideoId: true } }),
    prisma.referenceLift.findMany({ where: { status: "active" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.workoutCategory.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  return NextResponse.json({
    workouts: workouts.map((w) => ({
      id: w.id,
      title: w.title,
      status: w.status,
      sets: w._count.sets,
      category: w.category?.name ?? null,
    })),
    options: { exercises, referenceLifts, categories },
  });
}

// POST: full-replace save of a workout (create or update). Mirrors the web builder.
const difficultyTriple = z.object({ easy: z.number(), hard: z.number(), brutal: z.number() });
const schema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  instructions: z.string().default(""),
  roundingIncrementKg: z.number().positive().default(2.5),
  status: z.enum(["draft", "published"]).default("draft"),
  categoryId: z.string().min(1, "Pick a category"),
  backgroundImagePath: z.string().nullable().optional(),
  referenceLiftIds: z.array(z.string()),
  rankTiers: z.array(z.object({ name: z.string().min(1), icon: z.string().default("🏅"), minPoints: z.number().int().min(0) })),
  sets: z.array(
    z.object({
      label: z.string().optional().default(""),
      instructions: z.string().optional().default(""),
      points: difficultyTriple,
      parts: z.array(
        z.object({
          exerciseId: z.string().min(1),
          referenceLiftId: z.string().min(1),
          reps: z.string().optional().default(""),
          description: z.string().default(""),
          percentages: difficultyTriple,
        })
      ),
    })
  ),
});

export async function POST(req: Request) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  for (let i = 0; i < d.sets.length; i++) {
    const s = d.sets[i];
    if (s.parts.length === 0) return NextResponse.json({ error: `Set ${i + 1} needs at least one part` }, { status: 400 });
    for (const part of s.parts) {
      if (!d.referenceLiftIds.includes(part.referenceLiftId)) {
        return NextResponse.json({ error: `Set ${i + 1}: a part uses a reference lift not in this workout's required list` }, { status: 400 });
      }
    }
  }
  if (d.status === "published") {
    if (d.referenceLiftIds.length === 0) return NextResponse.json({ error: "Add at least one required reference lift before publishing" }, { status: 400 });
    if (d.sets.length === 0) return NextResponse.json({ error: "Add at least one set before publishing" }, { status: 400 });
    if (d.rankTiers.length === 0) return NextResponse.json({ error: "Add at least one rank tier before publishing" }, { status: 400 });
    if (!d.rankTiers.some((t) => t.minPoints === 0)) return NextResponse.json({ error: "Add an entry rank tier with 0 minimum points" }, { status: 400 });
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
      await tx.workoutSet.deleteMany({ where: { workoutId: id } });
    } else {
      const created = await tx.workout.create({ data: base });
      id = created.id;
    }

    await tx.workoutReferenceLift.createMany({
      data: d.referenceLiftIds.map((rid, i) => ({ workoutId: id!, referenceLiftId: rid, displayOrder: i })),
    });
    await tx.workoutRankTier.createMany({
      data: d.rankTiers.map((t, i) => ({ workoutId: id!, name: t.name, icon: t.icon, minPoints: t.minPoints, displayOrder: i })),
    });

    for (let si = 0; si < d.sets.length; si++) {
      const set = d.sets[si];
      const createdSet = await tx.workoutSet.create({
        data: {
          workoutId: id!,
          setOrder: si,
          label: set.label || null,
          instructions: set.instructions || null,
          points: { create: DIFFS.map((diff) => ({ difficulty: diff, points: Math.round(set.points[diff]) })) },
        },
      });
      for (let pi = 0; pi < set.parts.length; pi++) {
        const part = set.parts[pi];
        await tx.workoutSetPart.create({
          data: {
            workoutSetId: createdSet.id,
            partOrder: pi,
            exerciseId: part.exerciseId,
            referenceLiftId: part.referenceLiftId,
            reps: part.reps?.trim() || null,
            description: part.description,
            percentages: { create: DIFFS.map((diff) => ({ difficulty: diff, percentage: part.percentages[diff] })) },
          },
        });
      }
    }
    return id!;
  });

  return NextResponse.json({ ok: true, id: workoutId });
}
