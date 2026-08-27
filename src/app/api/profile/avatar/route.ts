import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";

// Set the user's avatar (gated by unlock level).
export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = z.object({ avatarId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const [avatar, profile] = await Promise.all([
    prisma.avatar.findUnique({ where: { id: parsed.data.avatarId } }),
    prisma.profile.findUnique({ where: { userId: user.id } }),
  ]);
  if (!avatar || !profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (profile.level < avatar.unlockLevel) return NextResponse.json({ error: "Reach a higher level to unlock this avatar" }, { status: 400 });

  await prisma.profile.update({ where: { userId: user.id }, data: { avatarId: parsed.data.avatarId } });
  return NextResponse.json({ ok: true });
}
