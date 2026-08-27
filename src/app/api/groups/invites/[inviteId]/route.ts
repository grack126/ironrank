import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";

// Accept or decline a group invite addressed to the current user.
export async function POST(req: Request, { params }: { params: Promise<{ inviteId: string }> }) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { inviteId } = await params;

  const parsed = z.object({ action: z.enum(["accept", "decline"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const invite = await prisma.groupInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  const ref = invite.inviteeRef.toLowerCase();
  const mine = ref === user.email.toLowerCase() || ref === (user.profile?.username ?? "").toLowerCase();
  if (!mine) return NextResponse.json({ error: "This invite isn't for you" }, { status: 403 });

  if (parsed.data.action === "decline") {
    await prisma.groupInvite.update({ where: { id: inviteId }, data: { status: "declined" } });
    return NextResponse.json({ ok: true });
  }

  if (invite.status !== "pending") return NextResponse.json({ error: "Invite not available" }, { status: 400 });
  await prisma.$transaction([
    prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: invite.groupId, userId: user.id } },
      update: {},
      create: { groupId: invite.groupId, userId: user.id, role: "member" },
    }),
    prisma.groupInvite.update({ where: { id: inviteId }, data: { status: "accepted" } }),
    prisma.notification.create({
      data: { userId: invite.invitedById, type: "invite_accepted", body: `${user.profile?.displayName ?? "Someone"} joined your group.`, link: `/groups/${invite.groupId}` },
    }),
  ]);
  return NextResponse.json({ ok: true, groupId: invite.groupId });
}
