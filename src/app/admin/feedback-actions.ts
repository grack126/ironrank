"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { feedbackWhere, type FeedbackFilter } from "@/lib/shared/feedback";

async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("FORBIDDEN");
  return user;
}

function revalidateFeedback() {
  revalidatePath("/admin/feedback");
  revalidatePath("/admin");
}

/** Toggle one row's read flag. */
export async function setFeedbackRead(id: string, isRead: boolean) {
  await requireAdmin();
  await prisma.workoutFeedback.update({ where: { id }, data: { isRead } });
  revalidateFeedback();
  return { ok: true as const, isRead };
}

/** Bulk-mark everything currently matching the filter (defaults to all unread). */
export async function markAllFeedbackRead(filter: FeedbackFilter) {
  await requireAdmin();
  const { count } = await prisma.workoutFeedback.updateMany({
    where: { ...feedbackWhere(filter), isRead: false },
    data: { isRead: true },
  });
  revalidateFeedback();
  return { ok: true as const, count };
}
