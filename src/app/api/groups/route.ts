import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";

const code = () => randomBytes(4).toString("hex").toUpperCase();

// GET: the user's groups, pending invites addressed to them, and unread notifications.
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const username = user.profile?.username ?? "";
  const refs = [username.toLowerCase(), user.email.toLowerCase(), username, user.email];

  const [memberships, invites, notifications] = await Promise.all([
    prisma.groupMember.findMany({
      where: { userId: user.id },
      include: { group: { include: { _count: { select: { members: true } } } } },
      orderBy: { joinedAt: "desc" },
    }),
    prisma.groupInvite.findMany({
      where: { status: "pending", inviteeRef: { in: refs } },
      include: { group: { select: { name: true } }, invitedBy: { select: { profile: { select: { displayName: true } } } } },
    }),
    prisma.notification.findMany({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return NextResponse.json({
    groups: memberships.map((m) => ({
      id: m.groupId,
      name: m.group.name,
      members: m.group._count.members,
      role: m.role,
    })),
    invites: invites.map((i) => ({ id: i.id, groupName: i.group.name, fromName: i.invitedBy.profile?.displayName ?? "Someone" })),
    notifications: notifications.map((n) => ({ id: n.id, body: n.body })),
  });
}

// POST: create a group (owner auto-joined). Returns the new group id.
export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = z.object({ name: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name.trim(),
      ownerId: user.id,
      inviteCode: code(),
      members: { create: { userId: user.id, role: "owner" } },
    },
  });
  return NextResponse.json({ ok: true, id: group.id });
}
