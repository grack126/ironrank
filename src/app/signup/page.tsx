import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignupForm } from "./SignupForm";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/workouts");
  return (
    <div style={{ paddingTop: 48 }}>
      <h1 className="center">
        Iron<span style={{ color: "var(--accent)" }}>Rank</span>
      </h1>
      <p className="center muted small" style={{ marginBottom: 24 }}>
        Create your account
      </p>
      <div className="card">
        <SignupForm />
      </div>
      <p className="center small muted">
        Already have an account? <Link href="/login" style={{ color: "var(--accent)" }}>Log in</Link>
      </p>
      <p className="center small muted" style={{ marginTop: 8 }}>
        The first account created becomes the admin.
      </p>
    </div>
  );
}
