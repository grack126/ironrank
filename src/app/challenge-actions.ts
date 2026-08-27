"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { primaryScore, type ChallengeType, type ScoringType } from "@/lib/shared/challenge";
import type { DotsSex } from "@/lib/shared/dots";
import { recordActivity, detectPR } from "@/lib/server-progression";

const payloadSchema = z.object({
  rawValue: z.number().positive("Enter a value greater than 0"),
  bodyweightKg: z.number().positive().nullable(),
  videoUrl: z.string().url("Enter a valid URL").nullable().or(z.literal("").transform(() => null)),
  syncedFromOffline: z.boolean().default(false),
});

export type SubmitChallengeResult =
  | { ok: true; status: "pending" | "unverified"; isPR: boolean; streak: number }
  | { ok: false; error: string };

export async function submitChallengeAttempt(
  challengeId: string,
  input: unknown
): Promise<SubmitChallengeResult> {
  const user = await requireUser();
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: { exercise: { select: { name: true } } },
  });
  if (!challenge || challenge.status !== "published") {
    return { ok: false, error: "Challenge not available" };
  }
  const now = new Date();
  if (now < challenge.startsAt || now > challenge.endsAt) {
    return { ok: false, error: "This challenge isn't currently open" };
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
      verificationStatus: status,
      syncedFromOffline: d.syncedFromOffline,
      // Snapshot the athlete's classes so leaderboard filtering stays stable.
      weightClassId: user.profile?.weightClassId ?? null,
      experienceClassId: user.profile?.experienceClassId ?? null,
    },
  });

  // Progression: streak activity + personal-record detection.
  const { currentStreak } = await recordActivity(user.id);
  const isPR = await detectPR({
    userId: user.id,
    movement: `${challenge.exercise.name} · ${challenge.challengeType}`,
    value: d.rawValue,
    unitLabel: challenge.unitLabel,
    challengeType: challenge.challengeType,
    submissionId: submission.id,
  });

  revalidatePath(`/challenges/${challengeId}`);
  revalidatePath("/challenges");
  revalidatePath("/profile");
  return { ok: true, status, isPR, streak: currentStreak };
}
