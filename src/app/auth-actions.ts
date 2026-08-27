"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
} from "@/lib/auth";

const signupSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only"),
});

export type ActionState = { error?: string } | undefined;

export async function signupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    username: formData.get("username"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { email, password, username } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { profile: { username } }] },
  });
  if (existing) return { error: "Email or username already taken" };

  const count = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      isAdmin: count === 0, // first account is the admin
      profile: {
        create: { username, displayName: username },
      },
    },
  });

  await createSession(user.id);
  redirect("/onboarding");
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { profile: true },
  });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Invalid email or password" };
  }

  await createSession(user.id);
  redirect(user.profile ? "/workouts" : "/onboarding");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
