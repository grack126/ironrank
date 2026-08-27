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

// ---------- Weight classes ----------

const weightSchema = z.object({
  name: z.string().min(1, "Name is required").max(40),
  gender: z.enum(["", "male", "female"]).default(""),
  minKg: z.coerce.number().min(0).optional().nullable(),
  maxKg: z.coerce.number().min(0).optional().nullable(),
});

export async function createWeightClass(input: unknown) {
  await requireAdmin();
  const parsed = weightSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const count = await prisma.weightCategory.count();
  await prisma.weightCategory.create({
    data: { name: d.name, gender: d.gender || null, minKg: d.minKg ?? null, maxKg: d.maxKg ?? null, displayOrder: count },
  });
  revalidatePath("/admin/classes");
  return { ok: true as const };
}

export async function updateWeightClass(id: string, input: unknown) {
  await requireAdmin();
  const parsed = weightSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;
  await prisma.weightCategory.update({
    where: { id },
    data: { name: d.name, gender: d.gender || null, minKg: d.minKg ?? null, maxKg: d.maxKg ?? null },
  });
  revalidatePath("/admin/classes");
  return { ok: true as const };
}

export async function setWeightClassStatus(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.weightCategory.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/classes");
  return { ok: true as const };
}

export async function deleteWeightClass(id: string) {
  await requireAdmin();
  const used =
    (await prisma.profile.count({ where: { weightClassId: id } })) +
    (await prisma.submission.count({ where: { weightClassId: id } }));
  if (used > 0) {
    await prisma.weightCategory.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/admin/classes");
    return { ok: true as const, archived: true };
  }
  await prisma.weightCategory.delete({ where: { id } });
  revalidatePath("/admin/classes");
  return { ok: true as const, archived: false };
}

// ---------- Experience classes ----------

const expSchema = z.object({ name: z.string().min(1, "Name is required").max(40) });

export async function createExperienceClass(input: unknown) {
  await requireAdmin();
  const parsed = expSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const count = await prisma.experienceClass.count();
  await prisma.experienceClass.create({ data: { name: parsed.data.name, displayOrder: count } });
  revalidatePath("/admin/classes");
  return { ok: true as const };
}

export async function updateExperienceClass(id: string, input: unknown) {
  await requireAdmin();
  const parsed = expSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  await prisma.experienceClass.update({ where: { id }, data: { name: parsed.data.name } });
  revalidatePath("/admin/classes");
  return { ok: true as const };
}

export async function setExperienceClassStatus(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.experienceClass.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/classes");
  return { ok: true as const };
}

export async function deleteExperienceClass(id: string) {
  await requireAdmin();
  const used =
    (await prisma.profile.count({ where: { experienceClassId: id } })) +
    (await prisma.submission.count({ where: { experienceClassId: id } }));
  if (used > 0) {
    await prisma.experienceClass.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/admin/classes");
    return { ok: true as const, archived: true };
  }
  await prisma.experienceClass.delete({ where: { id } });
  revalidatePath("/admin/classes");
  return { ok: true as const, archived: false };
}

// ---------- Reorder (shared) ----------

export async function moveClass(kind: "weight" | "experience", id: string, dir: -1 | 1) {
  await requireAdmin();
  const items =
    kind === "weight"
      ? await prisma.weightCategory.findMany({ orderBy: { displayOrder: "asc" }, select: { id: true } })
      : await prisma.experienceClass.findMany({ orderBy: { displayOrder: "asc" }, select: { id: true } });
  const i = items.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return { ok: true as const };

  if (kind === "weight") {
    await prisma.weightCategory.update({ where: { id: items[i].id }, data: { displayOrder: j } });
    await prisma.weightCategory.update({ where: { id: items[j].id }, data: { displayOrder: i } });
  } else {
    await prisma.experienceClass.update({ where: { id: items[i].id }, data: { displayOrder: j } });
    await prisma.experienceClass.update({ where: { id: items[j].id }, data: { displayOrder: i } });
  }
  revalidatePath("/admin/classes");
  return { ok: true as const };
}
