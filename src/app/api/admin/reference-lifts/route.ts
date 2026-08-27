import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiAdmin } from "@/lib/api-auth";

// GET: reference-lift catalogue (all statuses) for the admin list.
export async function GET(req: Request) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const lifts = await prisma.referenceLift.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({
    lifts: lifts.map((l) => ({ id: l.id, name: l.name, description: l.description, unit: l.unit, status: l.status })),
  });
}

// POST: create or update a reference lift (id present → update).
const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required").max(60),
  description: z.string().max(200).optional().default(""),
  unit: z.enum(["kg", "lb"]).default("kg"),
  status: z.enum(["active", "archived"]).optional(),
});

export async function POST(req: Request) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { id, status, ...rest } = parsed.data;
  const data = { ...rest, ...(status ? { status } : {}) };
  const saved = id
    ? await prisma.referenceLift.update({ where: { id }, data })
    : await prisma.referenceLift.create({ data });
  return NextResponse.json({ ok: true, id: saved.id });
}
