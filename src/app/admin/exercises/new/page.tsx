import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { ExerciseForm } from "@/components/ExerciseForm";

export default async function NewExercisePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  return (
    <>
      <TopBar right={<Link href="/admin/exercises" className="pill">← Library</Link>} />
      <h1>New exercise</h1>
      <div className="card">
        <ExerciseForm />
      </div>
    </>
  );
}
