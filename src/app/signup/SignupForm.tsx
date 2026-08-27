"use client";
import { useActionState } from "react";
import { signupAction, type ActionState } from "../auth-actions";
import { SubmitButton } from "@/components/SubmitButton";

export function SignupForm() {
  const [state, action] = useActionState<ActionState, FormData>(signupAction, undefined);
  return (
    <form action={action} className="stack">
      <div>
        <label>Username</label>
        <input name="username" placeholder="ironmike" required />
      </div>
      <div>
        <label>Email</label>
        <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      </div>
      <div>
        <label>Password</label>
        <input name="password" type="password" autoComplete="new-password" placeholder="At least 6 characters" required />
      </div>
      {state?.error && <p className="error">{state.error}</p>}
      <SubmitButton pendingLabel="Creating…">Create account</SubmitButton>
    </form>
  );
}
