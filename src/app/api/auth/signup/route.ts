import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createApiSession } from "@/lib/api-auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { email, password, username } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, { profile: { username } }] },
  });
  if (existing) return NextResponse.json({ error: "Email or username already taken" }, { status: 409 });

  const count = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      isAdmin: count === 0,
      profile: { create: { username, displayName: username } },
    },
    include: { profile: true },
  });

  const token = await createApiSession(user.id);
  return NextResponse.json({
    token,
    user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
    profile: user.profile,
    onboarded: false,
  });
}
