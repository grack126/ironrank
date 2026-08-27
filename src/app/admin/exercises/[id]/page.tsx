import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { ExerciseForm } from "@/components/ExerciseForm";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";

export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const ex = await prisma.exerciseLibrary.findUnique({ where: { id } });
  if (!ex) notFound();

  return (
    <>
      <TopBar right={<Link href="/admin/exercises" className="pill">← Library</Link>} />
      <h1>Edit exercise</h1>
      {ex.youtubeVideoId && (
        <div style={{ marginBottom: 14 }}>
          <YouTubeEmbed videoId={ex.youtubeVideoId} />
        </div>
      )}
      <div className="card">
        <ExerciseForm
          initial={{
            id: ex.id,
            name: ex.name,
            instructions: ex.instructions,
            youtubeVideoId: ex.youtubeVideoId,
            muscleGroup: ex.muscleGroup,
            equipment: ex.equipment,
            movementStandard: ex.movementStandard,
            tips: ex.tips,
            status: ex.status,
          }}
        />
      </div>
    </>
  );
}
