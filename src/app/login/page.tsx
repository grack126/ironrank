import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/workouts");
  return (
    <div style={{ paddingTop: 48 }}>
      <h1 className="center">
        Iron<span style={{ color: "var(--accent)" }}>Rank</span>
      </h1>
      <p className="center muted small" style={{ marginBottom: 24 }}>
        Earn your rank. Climb the board.
      </p>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Log in</h2>
        <LoginForm />
      </div>
      <p className="center small muted">
        No account? <Link href="/signup" style={{ color: "var(--accent)" }}>Create one</Link>
      </p>
    </div>
  );
}
