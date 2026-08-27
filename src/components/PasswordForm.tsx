"use client";
import { useActionState, useEffect, useRef } from "react";
import { changePasswordAction, type ProfileState } from "@/app/profile-actions";
import { SubmitButton } from "./SubmitButton";

/**
 * Change password. Requires the current one, and signs out other devices on
 * success (the action revokes every session except this browser's).
 */
export function PasswordForm() {
  const [state, action] = useActionState<ProfileState, FormData>(changePasswordAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields once the change goes through.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  return (
    <form ref={formRef} action={action} className="stack-2">
      <div>
        <label htmlFor="currentPassword">Current password</label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <label htmlFor="newPassword">New password</label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div>
        <label htmlFor="confirmPassword">Confirm new password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <p className="tiny faint" style={{ margin: 0 }}>
        At least 8 characters. Changing it signs you out on your other devices.
      </p>

      {state?.error && <p className="error">{state.error}</p>}
      {state?.ok && <p className="ok">Password updated.</p>}

      <SubmitButton>Change password</SubmitButton>
    </form>
  );
}
