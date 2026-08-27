import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";
import { formatRawValue, type ChallengeType } from "@/lib/shared/challenge";
import { displayWeight } from "@/lib/shared/units";

// Admin verification queue — submissions awaiting review.
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const pending = await prisma.submission.findMany({
    where: { verificationStatus: "pending" },
    include: {
      challenge: { select: { title: true, challengeType: true, unitLabel: true } },
      user: { select: { profile: { select: { displayName: true, username: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    items: pending.map((s) => ({
      id: s.id,
      challengeTitle: s.challenge.title,
      athlete: s.user.profile?.displayName ?? "Unknown",
      rawLabel: formatRawValue(s.rawValue, s.challenge.challengeType as ChallengeType, s.challenge.unitLabel),
      bodyweight: s.bodyweightAtAttemptKg != null ? `BW ${displayWeight(s.bodyweightAtAttemptKg, "kg")}` : "BW —",
      videoUrl: s.videoUrl,
      submittedAt: s.createdAt.toISOString(),
    })),
  });
}
