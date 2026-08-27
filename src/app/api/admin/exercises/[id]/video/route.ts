import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiAdmin } from "@/lib/api-auth";
import { isPrismaNotFound } from "@/lib/api-errors";
import { extractYoutubeId } from "@/lib/youtube";

// Update ONLY an exercise's demo video (used inline from the workout builder,
// where sending the full exercise payload would clobber other fields).
// Empty/blank URL clears the video.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;

  const parsed = z.object({ youtubeUrl: z.string() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  let youtubeVideoId: string | null = null;
  if (parsed.data.youtubeUrl.trim()) {
    youtubeVideoId = extractYoutubeId(parsed.data.youtubeUrl);
    if (!youtubeVideoId) return NextResponse.json({ error: "Could not parse a YouTube video ID from that URL" }, { status: 400 });
  }

  try {
    await prisma.exerciseLibrary.update({ where: { id }, data: { youtubeVideoId } });
  } catch (e) {
    if (isPrismaNotFound(e)) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    throw e;
  }
  return NextResponse.json({ ok: true, youtubeVideoId });
}
