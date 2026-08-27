import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiAdmin } from "@/lib/api-auth";
import { extractYoutubeId } from "@/lib/youtube";

// GET: full exercise library (all statuses) for the admin list.
export async function GET(req: Request) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const exercises = await prisma.exerciseLibrary.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({
    exercises: exercises.map((e) => ({
      id: e.id,
      name: e.name,
      instructions: e.instructions,
      youtubeVideoId: e.youtubeVideoId,
      muscleGroup: e.muscleGroup,
      equipment: e.equipment,
      movementStandard: e.movementStandard,
      tips: e.tips,
      status: e.status,
    })),
  });
}

// POST: create or update an exercise (id present → update).
const schema = z.object({
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

export async function POST(req: Request) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  const youtubeVideoId = d.youtubeUrl ? extractYoutubeId(d.youtubeUrl) : null;
  if (d.youtubeUrl && !youtubeVideoId) return NextResponse.json({ error: "Could not parse a YouTube video ID from that URL" }, { status: 400 });

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
  const saved = d.id
    ? await prisma.exerciseLibrary.update({ where: { id: d.id }, data })
    : await prisma.exerciseLibrary.create({ data });
  return NextResponse.json({ ok: true, id: saved.id });
}
