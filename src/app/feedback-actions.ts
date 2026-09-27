"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { COMMENT_MAX, DIFFICULTY_RATINGS, FEEDBACK_TYPES } from "@/lib/shared/feedback";

const schema = z.object({
  workoutId: z.string().min(1),
  workoutAttemptId: z.string().min(1).nullable(),
  difficultyRating: z.enum(DIFFICULTY_RATINGS),
  feedbackType: z.enum(FEEDBACK_TYPES).default("general"),
  comment: z.string().max(COMMENT_MAX).nullable(),
});

export type FeedbackResult = { ok: true } | { ok: false; error: string };

/**
 * Record one athlete's feedback on a workout. Scoped to the caller — the client
 * cannot submit on anyone else's behalf, and the attempt (when given) must be
 * their own attempt at this workout.
 */
export async function submitWorkoutFeedback(input: unknown): Promise<FeedbackResult> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please choose a difficulty rating." };
  const d = parsed.data;

  const workout = await prisma.workout.findUnique({ where: { id: d.workoutId }, select: { id: true } });
  if (!workout) return { ok: false, error: "Workout not found." };

  if (d.workoutAttemptId) {
    const attempt = await prisma.workoutAttempt.findUnique({
      where: { id: d.workoutAttemptId },
      select: { userId: true, workoutId: true },
    });
    if (!attempt || attempt.userId !== user.id || attempt.workoutId !== d.workoutId) {
      return { ok: false, error: "That attempt isn't yours." };
    }
  } else {
    // Postgres treats NULLs as distinct, so the @@unique([userId, workoutAttemptId])
    // constraint does not cover attempt-less feedback. Guard it here instead.
    const existing = await prisma.workoutFeedback.findFirst({
      where: { userId: user.id, workoutId: d.workoutId, workoutAttemptId: null },
      select: { id: true },
    });
    if (existing) return { ok: false, error: "You've already sent feedback for this workout." };
  }

  const comment = d.comment?.trim() || null;

  try {
    await prisma.workoutFeedback.create({
      data: {
        userId: user.id,
        workoutId: d.workoutId,
        workoutAttemptId: d.workoutAttemptId,
        difficultyRating: d.difficultyRating,
        feedbackType: d.feedbackType,
        comment,
      },
    });
  } catch (e) {
    // Unique violation — one submission per attempt.
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
      return { ok: false, error: "You've already sent feedback for this attempt." };
    }
    throw e;
  }

  revalidatePath("/admin/feedback");
  revalidatePath("/admin");
  return { ok: true };
}
