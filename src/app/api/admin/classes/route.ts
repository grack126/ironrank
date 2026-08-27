import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiAdmin } from "@/lib/api-auth";

// GET: all weight & experience classes (both active and archived).
export async function GET(req: Request) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const [weight, experience] = await Promise.all([
    prisma.weightCategory.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.experienceClass.findMany({ orderBy: { displayOrder: "asc" } }),
  ]);
  return NextResponse.json({
    weight: weight.map((w) => ({ id: w.id, name: w.name, gender: w.gender, minKg: w.minKg, maxKg: w.maxKg, isActive: w.isActive })),
    experience: experience.map((e) => ({ id: e.id, name: e.name, isActive: e.isActive })),
  });
}

// POST: create/update a weight or experience class.
const schema = z.object({
  kind: z.enum(["weight", "experience"]),
  id: z.string().optional(),
  name: z.string().min(1, "Name is required").max(40),
  gender: z.enum(["", "male", "female"]).optional().default(""),
  minKg: z.number().min(0).nullable().optional(),
  maxKg: z.number().min(0).nullable().optional(),
});

export async function POST(req: Request) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  if (d.kind === "weight") {
    const data = { name: d.name, gender: d.gender || null, minKg: d.minKg ?? null, maxKg: d.maxKg ?? null };
    if (d.id) await prisma.weightCategory.update({ where: { id: d.id }, data });
    else {
      const count = await prisma.weightCategory.count();
      await prisma.weightCategory.create({ data: { ...data, displayOrder: count } });
    }
  } else {
    if (d.id) await prisma.experienceClass.update({ where: { id: d.id }, data: { name: d.name } });
    else {
      const count = await prisma.experienceClass.count();
      await prisma.experienceClass.create({ data: { name: d.name, displayOrder: count } });
    }
  }
  return NextResponse.json({ ok: true });
}
