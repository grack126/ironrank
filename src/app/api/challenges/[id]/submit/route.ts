import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";
import { primaryScore, type ChallengeType, type ScoringType } from "@/lib/shared/challenge";
import type { DotsSex } from "@/lib/shared/dots";
import { recordActivity, detectPR } from "@/lib/server-progression";

// Log a challenge attempt. rawValue/bodyweight arrive already in kg for weight-based
// challenges (the mobile client converts from the user's unit, like the web form).
const schema = z.object({
  rawValue: z.number().positive(),
  bodyweightKg: z.number().positive().nullable(),
  videoUrl: z.string().url().nullable().or(z.literal("").transform(() => null)),
  videoIsPublic: z.boolean().default(false),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id: challengeId } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: { exercise: { select: { name: true } } },
  });
  if (!challenge || challenge.status !== "published") {
    return NextResponse.json({ error: "Challenge not available" }, { status: 404 });
  }
  const now = new Date();
  if (now < challenge.startsAt || now > challenge.endsAt) {
    return NextResponse.json({ error: "This challenge isn't currently open" }, { status: 400 });
  }

  const sex = (user.profile?.gender === "male" || user.profile?.gender === "female"
    ? user.profile.gender
    : null) as DotsSex | null;
  const bw = d.bodyweightKg ?? user.profile?.bodyweightKg ?? null;

  const computedScore = primaryScore(
    d.rawValue,
    challenge.challengeType as ChallengeType,
    challenge.scoringType as ScoringType,
    bw,
    sex
  );

  const status = d.videoUrl ? "pending" : "unverified";

  const submission = await prisma.submission.create({
    data: {
      challengeId,
      userId: user.id,
      rawValue: d.rawValue,
      bodyweightAtAttemptKg: bw,
      computedScore,
      videoUrl: d.videoUrl,
      // Only meaningful when there's a video; harmless otherwise.
      videoIsPublic: d.videoUrl ? d.videoIsPublic : false,
      verificationStatus: status,
      weightClassId: user.profile?.weightClassId ?? null,
      experienceClassId: user.profile?.experienceClassId ?? null,
    },
  });

  const { currentStreak } = await recordActivity(user.id);
  const isPR = await detectPR({
    userId: user.id,
    movement: `${challenge.exercise.name} · ${challenge.challengeType}`,
    value: d.rawValue,
    unitLabel: challenge.unitLabel,
    challengeType: challenge.challengeType,
    submissionId: submission.id,
  });

  return NextResponse.json({ ok: true, status, isPR, streak: currentStreak });
}
