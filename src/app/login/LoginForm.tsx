"use client";
import { useActionState } from "react";
import { loginAction, type ActionState } from "../auth-actions";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm() {
  const [state, action] = useActionState<ActionState, FormData>(loginAction, undefined);
  return (
    <form action={action} className="stack">
      <div>
        <label>Email</label>
        <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      </div>
      <div>
        <label>Password</label>
        <input name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && <p className="error">{state.error}</p>}
      <SubmitButton pendingLabel="Logging in…">Log in</SubmitButton>
    </form>
  );
}
