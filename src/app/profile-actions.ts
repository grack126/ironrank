"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, hashPassword, verifyPassword, currentSessionToken } from "@/lib/auth";
import { toKg } from "@/lib/shared/units";

const profileSchema = z.object({
  displayName: z.string().min(1, "Display name required").max(40),
  gender: z.enum(["male", "female", "unspecified"]),
  heightCm: z.coerce.number().min(0).max(260).optional(),
  bodyweight: z.coerce.number().min(0).max(500).optional(),
  experienceYears: z.coerce.number().min(0).max(80).optional(),
  weightClassId: z.string().min(1, "Pick a weight class"),
  experienceClassId: z.string().min(1, "Pick an experience class"),
  preferredUnits: z.enum(["kg", "lb"]),
});

export type ProfileState = { error?: string; ok?: boolean } | undefined;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "New password must be different from the current one",
    path: ["newPassword"],
  });

/**
 * Change the signed-in user's password. Requires the current password, so a
 * hijacked session alone can't lock the owner out. All other sessions are
 * revoked on success; the current one is kept so the user stays signed in.
 */
export async function changePasswordAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await requireUser();

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return { error: "Current password is incorrect" };

  const passwordHash = await hashPassword(parsed.data.newPassword);
  const currentToken = await currentSessionToken();

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    // Sign out everywhere else — a changed password should end other sessions.
    prisma.session.deleteMany({
      where: { userId: user.id, ...(currentToken ? { NOT: { token: currentToken } } : {}) },
    }),
  ]);

  revalidatePath("/profile");
  return { ok: true };
}

export async function saveProfileAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const bodyweightKg = d.bodyweight != null ? toKg(d.bodyweight, d.preferredUnits) : null;

  const data = {
    displayName: d.displayName,
    gender: d.gender,
    heightCm: d.heightCm ?? null,
    bodyweightKg,
    experienceYears: d.experienceYears ?? null,
    weightClassId: d.weightClassId,
    experienceClassId: d.experienceClassId,
    preferredUnits: d.preferredUnits,
  };

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: data,
    create: {
      userId: user.id,
      username: user.profile?.username ?? `lifter_${user.id.slice(0, 6)}`,
      ...data,
    },
  });

  revalidatePath("/profile");
  return { ok: true };
}

export async function setAvatarAction(avatarId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const [avatar, profile] = await Promise.all([
    prisma.avatar.findUnique({ where: { id: avatarId } }),
    prisma.profile.findUnique({ where: { userId: user.id } }),
  ]);
  if (!avatar || !profile) return { ok: false, error: "Not found" };
  if (profile.level < avatar.unlockLevel) return { ok: false, error: "Reach a higher level to unlock this avatar" };
  await prisma.profile.update({ where: { userId: user.id }, data: { avatarId } });
  revalidatePath("/profile");
  return { ok: true };
}
