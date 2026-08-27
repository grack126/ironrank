import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { ChallengeForm } from "@/components/ChallengeForm";

export default async function NewChallengePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const [exercises, seasons] = await Promise.all([
    prisma.exerciseLibrary.findMany({ where: { status: "published" }, orderBy: { name: "asc" }, select: { id: true, name: true, youtubeVideoId: true } }),
    prisma.season.findMany({ orderBy: { startsAt: "desc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <TopBar right={<Link href="/admin/challenges" className="pill">← Challenges</Link>} />
      <h1>New challenge</h1>
      {exercises.length === 0 ? (
        <p className="muted">Add a published exercise to the library first.</p>
      ) : (
        <div className="card">
          <ChallengeForm exercises={exercises} seasons={seasons} />
        </div>
      )}
    </>
  );
}
