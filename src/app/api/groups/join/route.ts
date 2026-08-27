import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";

// Join a group by its invite code.
export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = z.object({ code: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a code" }, { status: 400 });

  const group = await prisma.group.findUnique({ where: { inviteCode: parsed.data.code.trim().toUpperCase() } });
  if (!group) return NextResponse.json({ error: "No group with that code" }, { status: 404 });

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    update: {},
    create: { groupId: group.id, userId: user.id, role: "member" },
  });
  return NextResponse.json({ ok: true, groupId: group.id });
}
