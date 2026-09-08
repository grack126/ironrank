import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TabBar } from "@/components/TabBar";
import { TopBar } from "@/components/TopBar";
import { SectionTitle, IconAdmin } from "@/components/ui/icons";

export default async function AdminHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const [exercises, refs, workouts, published, challenges, pending] = await Promise.all([
    prisma.exerciseLibrary.count(),
    prisma.referenceLift.count(),
    prisma.workout.count(),
    prisma.workout.count({ where: { status: "published" } }),
    prisma.challenge.count(),
    prisma.submission.count({ where: { verificationStatus: "pending" } }),
  ]);

  return (
    <>
      <TopBar right={<span className="pill accent">Admin</span>} />
      <SectionTitle as="h1" icon={IconAdmin}>Admin</SectionTitle>
      <p className="muted small">Manage shared content for challenges and workouts.</p>

      <Link href="/admin/exercises" className="card" style={{ display: "block" }}>
        <div className="row between">
          <div>
            <h2 style={{ margin: 0 }}>Exercise library</h2>
            <span className="small muted">{exercises} exercises · names, instructions & demo videos</span>
          </div>
          <span className="pill">Open →</span>
        </div>
      </Link>

      <Link href="/admin/reference-lifts" className="card" style={{ display: "block" }}>
        <div className="row between">
          <div>
            <h2 style={{ margin: 0 }}>Reference lifts</h2>
            <span className="small muted">{refs} lifts · the 10RMs workouts calculate from</span>
          </div>
          <span className="pill">Open →</span>
        </div>
      </Link>

      <Link href="/admin/workouts" className="card" style={{ display: "block" }}>
        <div className="row between">
          <div>
            <h2 style={{ margin: 0 }}>Workout builder</h2>
            <span className="small muted">{workouts} total · {published} published</span>
          </div>
          <span className="pill">Open →</span>
        </div>
      </Link>

      <Link href="/admin/challenges" className="card" style={{ display: "block" }}>
        <div className="row between">
          <div>
            <h2 style={{ margin: 0 }}>Challenges</h2>
            <span className="small muted">{challenges} total</span>
          </div>
          <span className="pill">Open →</span>
        </div>
      </Link>

      <Link href="/admin/classes" className="card" style={{ display: "block" }}>
        <div className="row between">
          <div>
            <h2 style={{ margin: 0 }}>Weight & experience classes</h2>
            <span className="small muted">Athlete class catalogues</span>
          </div>
          <span className="pill">Open →</span>
        </div>
      </Link>

      <Link href="/admin/workout-categories" className="card" style={{ display: "block" }}>
        <div className="row between">
          <div>
            <h2 style={{ margin: 0 }}>Workout categories</h2>
            <span className="small muted">Plans shown on the Workouts tab</span>
          </div>
          <span className="pill">Open →</span>
        </div>
      </Link>

      <Link href="/admin/scores" className="card" style={{ display: "block" }}>
        <div className="row between">
          <div>
            <h2 style={{ margin: 0 }}>Scores</h2>
            <span className="small muted">Wipe an athlete&apos;s results, or reset the leaderboard</span>
          </div>
          <span className="pill">Open →</span>
        </div>
      </Link>

      <Link href="/admin/verification" className="card" style={{ display: "block" }}>
        <div className="row between">
          <div>
            <h2 style={{ margin: 0 }}>Verification queue</h2>
            <span className="small muted">{pending} awaiting review</span>
          </div>
          <span className={`pill ${pending > 0 ? "accent" : ""}`}>{pending > 0 ? `${pending} pending` : "Clear"}</span>
        </div>
      </Link>

      <div className="stack">
        <Link href="/admin/challenges/new" className="btn">+ New challenge</Link>
        <Link href="/admin/workouts/new" className="btn secondary">+ New workout</Link>
        <Link href="/admin/exercises/new" className="btn secondary">+ New exercise</Link>
      </div>

      <TabBar isAdmin />
    </>
  );
}
