import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiAdmin } from "@/lib/api-auth";

// GET: all workout categories (active + archived), with usage counts.
export async function GET(req: Request) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const cats = await prisma.workoutCategory.findMany({
    orderBy: { displayOrder: "asc" },
    include: { _count: { select: { workouts: true } } },
  });
  return NextResponse.json({
    categories: cats.map((c) => ({ id: c.id, name: c.name, description: c.description, imageRef: c.imageRef, isActive: c.isActive, workouts: c._count.workouts })),
  });
}

// POST: create or update a workout category (id present → update).
const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required").max(50),
  description: z.string().max(200).optional().default(""),
  imageRef: z.string().max(200).optional().default(""),
});

export async function POST(req: Request) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;
  const data = { name: d.name, description: d.description || null, imageRef: d.imageRef || null };

  if (d.id) {
    await prisma.workoutCategory.update({ where: { id: d.id }, data });
  } else {
    const count = await prisma.workoutCategory.count();
    await prisma.workoutCategory.create({ data: { ...data, displayOrder: count } });
  }
  return NextResponse.json({ ok: true });
}
