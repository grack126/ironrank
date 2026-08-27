import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";

// Owner removes a member.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id: groupId } = await params;

  const parsed = z.object({ userId: z.string().min(1), action: z.literal("remove") }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.ownerId !== user.id) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (parsed.data.userId === group.ownerId) return NextResponse.json({ error: "Can't remove the owner" }, { status: 400 });

  await prisma.groupMember.deleteMany({ where: { groupId, userId: parsed.data.userId } });
  return NextResponse.json({ ok: true });
}
