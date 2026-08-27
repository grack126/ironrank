import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiAdmin } from "@/lib/api-auth";
import { extractYoutubeId } from "@/lib/youtube";

// GET: all challenges for the admin list, plus the options a form needs
// (exercises with their demo video ids, and seasons).
export async function GET(req: Request) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const [challenges, exercises, seasons] = await Promise.all([
    prisma.challenge.findMany({ include: { exercise: { select: { name: true } } }, orderBy: { endsAt: "desc" } }),
    prisma.exerciseLibrary.findMany({ where: { status: "published" }, orderBy: { name: "asc" }, select: { id: true, name: true, youtubeVideoId: true } }),
    prisma.season.findMany({ orderBy: { startsAt: "desc" }, select: { id: true, name: true } }),
  ]);

  return NextResponse.json({
    challenges: challenges.map((c) => ({
      id: c.id,
      title: c.title,
      exercise: c.exercise.name,
      challengeType: c.challengeType,
      status: c.status,
      isDaily: c.isDaily,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
    })),
    exercises,
    seasons,
  });
}

// POST: create or update a challenge (id present → update).
const schema = z
  .object({
    id: z.string().optional(),
    exerciseId: z.string().min(1, "Pick an exercise"),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional().default(""),
    movementStandard: z.string().optional().default(""),
    demoVideoUrl: z.string().optional().default(""),
    unitLabel: z.string().min(1).default("kg"),
    challengeType: z.enum(["max_weight", "max_reps", "tonnage", "for_time", "amrap"]),
    scoringType: z.enum(["absolute", "relative_dots"]),
    startsAt: z.string().min(1, "Start date is required"),
    endsAt: z.string().min(1, "End date is required"),
    isDaily: z.boolean().default(false),
    status: z.enum(["draft", "published", "closed", "archived"]).default("draft"),
    seasonId: z.string().optional().default(""),
    backgroundImagePath: z.string().nullable().optional(),
  })
  .refine((d) => new Date(d.endsAt) > new Date(d.startsAt), { message: "End must be after start", path: ["endsAt"] });

export async function POST(req: Request) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  let demoYoutubeVideoId: string | null = null;
  if (d.demoVideoUrl.trim()) {
    demoYoutubeVideoId = extractYoutubeId(d.demoVideoUrl);
    if (!demoYoutubeVideoId) return NextResponse.json({ error: "Could not parse a YouTube video ID from that demo URL" }, { status: 400 });
  }

  const data = {
    exerciseId: d.exerciseId,
    title: d.title,
    description: d.description,
    movementStandard: d.movementStandard || null,
    demoYoutubeVideoId,
    unitLabel: d.unitLabel,
    challengeType: d.challengeType,
    scoringType: d.scoringType,
    startsAt: new Date(d.startsAt),
    endsAt: new Date(d.endsAt),
    isDaily: d.isDaily,
    status: d.status,
    seasonId: d.seasonId || null,
    backgroundImagePath: d.backgroundImagePath ?? null,
  };
  const saved = d.id
    ? await prisma.challenge.update({ where: { id: d.id }, data })
    : await prisma.challenge.create({ data });
  return NextResponse.json({ ok: true, id: saved.id });
}
