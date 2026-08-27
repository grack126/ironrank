import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createApiSession } from "@/lib/api-auth";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    include: { profile: true },
  });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createApiSession(user.id);
  return NextResponse.json({
    token,
    user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
    profile: user.profile,
    onboarded: !!user.profile?.weightClassId && !!user.profile?.experienceClassId,
  });
}
