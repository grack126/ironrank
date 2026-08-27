"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addXp, finalizeDueChallenges, finalizeChallenge } from "@/lib/server-progression";
import { extractYoutubeId } from "@/lib/youtube";

async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("FORBIDDEN");
  return user;
}

const challengeSchema = z
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
    isDaily: z.coerce.boolean().default(false),
    status: z.enum(["draft", "published", "closed", "archived"]).default("draft"),
    seasonId: z.string().optional().default(""),
    backgroundImagePath: z.string().optional().default(""),
  })
  .refine((d) => new Date(d.endsAt) > new Date(d.startsAt), {
    message: "End must be after start",
    path: ["endsAt"],
  });

export async function saveChallengeAction(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData);
  const parsed = challengeSchema.safeParse({ ...raw, isDaily: formData.get("isDaily") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  // Resolve the demo video: parse the pasted URL to a video ID (blank clears it).
  let demoYoutubeVideoId: string | null = null;
  if (d.demoVideoUrl.trim()) {
    demoYoutubeVideoId = extractYoutubeId(d.demoVideoUrl);
    if (!demoYoutubeVideoId) return { error: "Could not parse a YouTube video ID from that demo URL" };
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
    backgroundImagePath: d.backgroundImagePath || null,
  };

  if (d.id) await prisma.challenge.update({ where: { id: d.id }, data });
  else await prisma.challenge.create({ data });

  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");
  redirect("/admin/challenges");
}

// ---------- Verification queue ----------

const XP_VERIFIED = 25;

export async function verifySubmissionAction(submissionId: string) {
  const admin = await requireAdmin();
  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!sub) return { error: "Submission not found" };

  await prisma.submission.update({
    where: { id: submissionId },
    data: { verificationStatus: "verified", verifiedById: admin.id, verificationNotes: null },
  });

  // XP is immediate on verification; placement badges are awarded only when the
  // challenge is finalized (see finalizeDueChallengesAction).
  if (sub.verificationStatus !== "verified") {
    await addXp(sub.userId, XP_VERIFIED);
  }

  revalidatePath("/admin/verification");
  revalidatePath("/challenges");
  revalidatePath("/leaderboard");
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function rejectSubmissionAction(submissionId: string, notes: string) {
  const admin = await requireAdmin();
  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!sub) return { error: "Submission not found" };

  // If it was previously verified, claw back the XP we awarded.
  if (sub.verificationStatus === "verified") {
    await addXp(sub.userId, -XP_VERIFIED);
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: { verificationStatus: "rejected", verifiedById: admin.id, verificationNotes: notes || null },
  });

  revalidatePath("/admin/verification");
  revalidatePath("/challenges");
  return { ok: true as const };
}

// ---------- Finalization (placement badges) ----------
// In production this runs on a schedule (pg_cron + a Supabase Edge Function /
// Postgres function). Locally it's exposed as an admin-triggered action.

export async function finalizeDueChallengesAction() {
  await requireAdmin();
  const count = await finalizeDueChallenges();
  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");
  revalidatePath("/profile");
  revalidatePath("/leaderboard");
  return { ok: true as const, count };
}

/**
 * Show/hide a challenge on the athlete-facing Challenges tab, which lists
 * "published" and "closed". Hiding parks it in "archived"; showing restores the
 * status the challenge should have for its dates — "closed" once it has ended or
 * been finalized, otherwise "published". Placements and entries are untouched.
 */
export async function setChallengeVisibility(challengeId: string, visible: boolean) {
  await requireAdmin();
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { endsAt: true, finalizedAt: true },
  });
  if (!challenge) return { ok: false as const, error: "Challenge not found" };

  const ended = !!challenge.finalizedAt || challenge.endsAt < new Date();
  const status = visible ? (ended ? "closed" : "published") : "archived";

  await prisma.challenge.update({ where: { id: challengeId }, data: { status } });
  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");
  return { ok: true as const, status };
}

export async function finalizeChallengeAction(challengeId: string) {
  await requireAdmin();
  const r = await finalizeChallenge(challengeId);
  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");
  revalidatePath("/profile");
  return { ok: true as const, finalized: r.finalized };
}
