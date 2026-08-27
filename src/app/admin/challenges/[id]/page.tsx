import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { ChallengeForm } from "@/components/ChallengeForm";

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const [challenge, exercises, seasons] = await Promise.all([
    prisma.challenge.findUnique({ where: { id } }),
    prisma.exerciseLibrary.findMany({ where: { status: "published" }, orderBy: { name: "asc" }, select: { id: true, name: true, youtubeVideoId: true } }),
    prisma.season.findMany({ orderBy: { startsAt: "desc" }, select: { id: true, name: true } }),
  ]);
  if (!challenge) notFound();

  return (
    <>
      <TopBar right={<Link href="/admin/challenges" className="pill">← Challenges</Link>} />
      <h1>Edit challenge</h1>
      <div className="card">
        <ChallengeForm
          exercises={exercises}
          seasons={seasons}
          initial={{
            id: challenge.id,
            exerciseId: challenge.exerciseId,
            title: challenge.title,
            description: challenge.description,
            movementStandard: challenge.movementStandard,
            demoYoutubeVideoId: challenge.demoYoutubeVideoId,
            unitLabel: challenge.unitLabel,
            challengeType: challenge.challengeType,
            scoringType: challenge.scoringType,
            startsAt: toLocalInput(challenge.startsAt),
            endsAt: toLocalInput(challenge.endsAt),
            isDaily: challenge.isDaily,
            status: challenge.status,
            seasonId: challenge.seasonId,
            backgroundImagePath: challenge.backgroundImagePath,
          }}
        />
      </div>
    </>
  );
}
