"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const code = () => randomBytes(4).toString("hex").toUpperCase();
const token = () => randomBytes(16).toString("hex");

/** Authorization gate — the SQLite stand-in for the spec's RLS membership policy. */
async function requireMembership(groupId: string, userId: string) {
  const m = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!m) throw new Error("FORBIDDEN");
  return m;
}

export async function createGroupAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required" };
  const group = await prisma.group.create({
    data: {
      name,
      ownerId: user.id,
      inviteCode: code(),
      members: { create: { userId: user.id, role: "owner" } },
    },
  });
  revalidatePath("/groups");
  redirect(`/groups/${group.id}`);
}

export async function inviteByRefAction(groupId: string, refRaw: unknown) {
  const user = await requireUser();
  await requireMembership(groupId, user.id);
  const ref = z.string().min(1).safeParse(refRaw);
  if (!ref.success) return { ok: false as const, error: "Enter a username or email" };
  const value = ref.data.trim();

  // Find the target user (username or email), if they exist.
  const target = await prisma.user.findFirst({
    where: { OR: [{ email: value.toLowerCase() }, { profile: { username: value } }] },
    include: { profile: true },
  });
  if (target) {
    const already = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: target.id } } });
    if (already) return { ok: false as const, error: "Already a member" };
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  await prisma.groupInvite.create({
    data: { groupId, invitedById: user.id, inviteeRef: value, token: token() },
  });
  if (target) {
    await prisma.notification.create({
      data: {
        userId: target.id,
        type: "group_invite",
        body: `${user.profile?.displayName ?? "Someone"} invited you to "${group?.name}".`,
        link: "/groups",
      },
    });
  }
  revalidatePath(`/groups/${groupId}`);
  return { ok: true as const, existsAsUser: !!target };
}

export async function acceptInviteAction(inviteId: string) {
  const user = await requireUser();
  const invite = await prisma.groupInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.status !== "pending") return { ok: false as const, error: "Invite not available" };
  // The invite must be addressed to this user.
  const ref = invite.inviteeRef.toLowerCase();
  const mine = ref === user.email.toLowerCase() || ref === (user.profile?.username ?? "").toLowerCase();
  if (!mine) return { ok: false as const, error: "This invite isn't for you" };

  await prisma.$transaction([
    prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: invite.groupId, userId: user.id } },
      update: {},
      create: { groupId: invite.groupId, userId: user.id, role: "member" },
    }),
    prisma.groupInvite.update({ where: { id: inviteId }, data: { status: "accepted" } }),
    prisma.notification.create({
      data: {
        userId: invite.invitedById,
        type: "invite_accepted",
        body: `${user.profile?.displayName ?? "Someone"} joined your group.`,
        link: `/groups/${invite.groupId}`,
      },
    }),
  ]);
  revalidatePath("/groups");
  return { ok: true as const, groupId: invite.groupId };
}

export async function declineInviteAction(inviteId: string) {
  const user = await requireUser();
  const invite = await prisma.groupInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return { ok: false as const, error: "Invite not found" };
  const ref = invite.inviteeRef.toLowerCase();
  const mine = ref === user.email.toLowerCase() || ref === (user.profile?.username ?? "").toLowerCase();
  if (!mine) return { ok: false as const, error: "This invite isn't for you" };
  await prisma.groupInvite.update({ where: { id: inviteId }, data: { status: "declined" } });
  revalidatePath("/groups");
  return { ok: true as const };
}

export async function joinByCodeAction(formData: FormData) {
  const user = await requireUser();
  const codeVal = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!codeVal) return { error: "Enter a code" };
  const group = await prisma.group.findUnique({ where: { inviteCode: codeVal } });
  if (!group) return { error: "No group with that code" };
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    update: {},
    create: { groupId: group.id, userId: user.id, role: "member" },
  });
  redirect(`/groups/${group.id}`);
}

export async function removeMemberAction(groupId: string, userId: string) {
  const user = await requireUser();
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.ownerId !== user.id) return { ok: false as const, error: "Owner only" };
  if (userId === group.ownerId) return { ok: false as const, error: "Can't remove the owner" };
  await prisma.groupMember.deleteMany({ where: { groupId, userId } });
  revalidatePath(`/groups/${groupId}`);
  return { ok: true as const };
}

export async function deleteGroupAction(groupId: string) {
  const user = await requireUser();
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.ownerId !== user.id) return { ok: false as const, error: "Owner only" };
  await prisma.group.delete({ where: { id: groupId } });
  revalidatePath("/groups");
  redirect("/groups");
}

export async function markNotificationsReadAction() {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/groups");
  return { ok: true as const };
}
