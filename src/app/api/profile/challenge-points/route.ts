import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";

// Breakdown of the user's challenge points: which challenges + weight classes
// awarded them, most recent first. Feeds the profile "history" view.
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const log = await prisma.challengePointsLog.findMany({
    where: { userId: user.id },
    include: { challenge: { select: { title: true } }, weightClass: { select: { name: true } } },
    orderBy: { awardedAt: "desc" },
  });

  return NextResponse.json({
    total: log.reduce((sum, e) => sum + e.pointsAwarded, 0),
    entries: log.map((e) => ({
      id: e.id,
      challenge: e.challenge.title,
      weightClass: e.weightClass.name,
      placement: e.placement,
      points: e.pointsAwarded,
      awardedAt: e.awardedAt.toISOString(),
    })),
  });
}
