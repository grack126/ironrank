import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";

const token = () => randomBytes(16).toString("hex");

// Invite someone by username or email (members only). Notifies them if they exist.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id: groupId } = await params;

  const membership = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (!membership) return NextResponse.json({ error: "Members only" }, { status: 403 });

  const parsed = z.object({ ref: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a username or email" }, { status: 400 });
  const value = parsed.data.ref.trim();

  const target = await prisma.user.findFirst({
    where: { OR: [{ email: value.toLowerCase() }, { profile: { username: value } }] },
    include: { profile: true },
  });
  if (target) {
    const already = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: target.id } } });
    if (already) return NextResponse.json({ error: "Already a member" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  await prisma.groupInvite.create({ data: { groupId, invitedById: user.id, inviteeRef: value, token: token() } });
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
  return NextResponse.json({ ok: true, existsAsUser: !!target });
}
