import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { FeedbackTriage, type FeedbackRow } from "@/components/FeedbackTriage";
import { feedbackWhere } from "@/lib/shared/feedback";

type Search = { workout?: string; rating?: string; type?: string; read?: string };

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const sp = await searchParams;
  const where = feedbackWhere({
    workoutId: sp.workout,
    difficultyRating: sp.rating,
    feedbackType: sp.type,
    readState: sp.read,
  });

  const [items, workouts, unreadInView, unreadTotal] = await Promise.all([
    prisma.workoutFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        workout: { select: { id: true, title: true } },
        user: { select: { profile: { select: { username: true, displayName: true } } } },
      },
    }),
    // Only workouts that actually have feedback are worth filtering by.
    prisma.workout.findMany({
      where: { feedback: { some: {} } },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    prisma.workoutFeedback.count({ where: { ...where, isRead: false } }),
    prisma.workoutFeedback.count({ where: { isRead: false } }),
  ]);

  const rows: FeedbackRow[] = items.map((f) => ({
    id: f.id,
    workoutId: f.workoutId,
    workoutTitle: f.workout.title,
    username: f.user.profile?.username ?? "unknown",
    displayName: f.user.profile?.displayName ?? "Unknown",
    difficultyRating: f.difficultyRating,
    feedbackType: f.feedbackType,
    comment: f.comment,
    isRead: f.isRead,
    createdAt: f.createdAt.toLocaleString(),
  }));

  return (
    <>
      <TopBar right={<Link href="/admin" className="pill">← Admin</Link>} />
      <h1>Feedback</h1>
      <p className="muted small">
        What athletes say about your workouts — difficulty calibration and bug reports,
        newest first. {unreadTotal > 0 ? `${unreadTotal} unread overall.` : "All caught up."}
      </p>

      <FeedbackTriage rows={rows} workouts={workouts} unreadInView={unreadInView} />
    </>
  );
}
