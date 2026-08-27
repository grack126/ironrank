"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("FORBIDDEN");
  return user;
}

const schema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  description: z.string().max(200).optional().default(""),
  imageRef: z.string().max(200).optional().default(""),
});

export async function createWorkoutCategory(input: unknown) {
  await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const count = await prisma.workoutCategory.count();
  await prisma.workoutCategory.create({
    data: { name: parsed.data.name, description: parsed.data.description || null, imageRef: parsed.data.imageRef || null, displayOrder: count },
  });
  revalidatePath("/admin/workout-categories");
  revalidatePath("/workouts");
  return { ok: true as const };
}

export async function updateWorkoutCategory(id: string, input: unknown) {
  await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  await prisma.workoutCategory.update({
    where: { id },
    data: { name: parsed.data.name, description: parsed.data.description || null, imageRef: parsed.data.imageRef || null },
  });
  revalidatePath("/admin/workout-categories");
  revalidatePath("/workouts");
  return { ok: true as const };
}

export async function setWorkoutCategoryStatus(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.workoutCategory.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/workout-categories");
  revalidatePath("/workouts");
  return { ok: true as const };
}

export async function deleteWorkoutCategory(id: string) {
  await requireAdmin();
  const used = await prisma.workout.count({ where: { categoryId: id } });
  if (used > 0) {
    await prisma.workoutCategory.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/admin/workout-categories");
    return { ok: true as const, archived: true };
  }
  await prisma.workoutCategory.delete({ where: { id } });
  revalidatePath("/admin/workout-categories");
  return { ok: true as const, archived: false };
}

export async function moveWorkoutCategory(id: string, dir: -1 | 1) {
  await requireAdmin();
  const items = await prisma.workoutCategory.findMany({ orderBy: { displayOrder: "asc" }, select: { id: true } });
  const i = items.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return { ok: true as const };
  await prisma.workoutCategory.update({ where: { id: items[i].id }, data: { displayOrder: j } });
  await prisma.workoutCategory.update({ where: { id: items[j].id }, data: { displayOrder: i } });
  revalidatePath("/admin/workout-categories");
  revalidatePath("/workouts");
  return { ok: true as const };
}
