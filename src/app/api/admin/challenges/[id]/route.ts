import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiAdmin } from "@/lib/api-auth";
import { isPrismaNotFound } from "@/lib/api-errors";

// GET: a single challenge in edit-form shape (dates as ISO strings).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;

  const c = await prisma.challenge.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: c.id,
    exerciseId: c.exerciseId,
    title: c.title,
    description: c.description,
    movementStandard: c.movementStandard,
    demoYoutubeVideoId: c.demoYoutubeVideoId,
    unitLabel: c.unitLabel,
    challengeType: c.challengeType,
    scoringType: c.scoringType,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
    isDaily: c.isDaily,
    status: c.status,
    seasonId: c.seasonId,
    backgroundImagePath: c.backgroundImagePath,
    finalizedAt: c.finalizedAt ? c.finalizedAt.toISOString() : null,
  });
}

// DELETE: remove a challenge (cascades submissions per schema).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;
  try {
    await prisma.challenge.delete({ where: { id } });
  } catch (e) {
    if (isPrismaNotFound(e)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}
