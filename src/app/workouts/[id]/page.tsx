import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { WorkoutRunner, type RunnerData } from "@/components/WorkoutRunner";
import { type Unit } from "@/lib/shared/units";
import type { Difficulty } from "@/lib/shared/workout";

type Row = { difficulty: string; value: number };
function triple(rows: Row[]) {
  const t = { easy: 0, hard: 0, brutal: 0 };
  for (const r of rows) (t as Record<Difficulty, number>)[r.difficulty as Difficulty] = r.value;
  return t;
}

export default async function WorkoutDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profile) redirect("/onboarding");
  const unit = (user.profile.preferredUnits as Unit) || "kg";

  const workout = await prisma.workout.findUnique({
    where: { id },
    include: {
      referenceLifts: { include: { referenceLift: true }, orderBy: { displayOrder: "asc" } },
      rankTiers: { orderBy: { minPoints: "asc" } },
      sets: {
        orderBy: { setOrder: "asc" },
        include: {
          points: true,
          parts: {
            orderBy: { partOrder: "asc" },
            include: { exercise: true, referenceLift: true, percentages: true },
          },
        },
      },
    },
  });
  if (!workout || workout.status !== "published") notFound();

  const userRefs = await prisma.userReferenceLift.findMany({ where: { userId: user.id } });
  const refMap = new Map(userRefs.map((r) => [r.referenceLiftId, r.weightKg]));

  const runnerData: RunnerData = {
    workoutId: workout.id,
    title: workout.title,
    instructions: workout.instructions,
    unit,
    incrementKg: workout.roundingIncrementKg,
    rankTiers: workout.rankTiers.map((t) => ({ name: t.name, icon: t.icon, minPoints: t.minPoints })),
    referenceLifts: workout.referenceLifts.map((wr) => ({
      id: wr.referenceLift.id,
      name: wr.referenceLift.name,
      description: wr.referenceLift.description,
      currentKg: refMap.get(wr.referenceLift.id) ?? null,
    })),
    sets: workout.sets.map((s) => ({
      id: s.id,
      label: s.label,
      instructions: s.instructions,
      points: triple(s.points.map((p) => ({ difficulty: p.difficulty, value: p.points }))),
      parts: s.parts.map((part) => ({
        id: part.id,
        exerciseId: part.exerciseId,
        exerciseName: part.exercise.name,
        partLabel: part.label,
        exerciseInstructions: part.exercise.instructions,
        youtubeVideoId: part.exercise.youtubeVideoId ?? null,
        referenceLiftId: part.referenceLiftId,
        referenceLiftName: part.referenceLift.name,
        reps: part.reps,
        description: part.description,
        percentages: triple(part.percentages.map((p) => ({ difficulty: p.difficulty, value: p.percentage }))),
        // Reps may differ per difficulty; null entries fall back to `reps` above.
        repsByDifficulty: {
          easy: part.percentages.find((p) => p.difficulty === "easy")?.reps ?? null,
          hard: part.percentages.find((p) => p.difficulty === "hard")?.reps ?? null,
          brutal: part.percentages.find((p) => p.difficulty === "brutal")?.reps ?? null,
        },
      })),
    })),
  };

  return (
    <>
      <TopBar right={<Link href="/workouts" className="pill">← Workouts</Link>} />
      <WorkoutRunner data={runnerData} />
    </>
  );
}
