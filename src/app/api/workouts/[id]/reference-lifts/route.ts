import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";
import { toKg, type Unit } from "@/lib/shared/units";

// Save the user's reference-lift numbers (entered in their preferred unit).
const schema = z.object({
  refs: z.record(z.string(), z.number()),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  await params; // workout id is contextual only

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const unit = (user.profile?.preferredUnits as Unit) || "kg";
  // One batched transaction instead of a sequential upsert per lift.
  const upserts = Object.entries(parsed.data.refs)
    .filter(([, value]) => !isNaN(value) && value > 0)
    .map(([referenceLiftId, value]) => {
      const weightKg = toKg(value, unit);
      return prisma.userReferenceLift.upsert({
        where: { userId_referenceLiftId: { userId: user.id, referenceLiftId } },
        update: { weightKg, recordedAt: new Date() },
        create: { userId: user.id, referenceLiftId, weightKg },
      });
    });
  if (upserts.length > 0) await prisma.$transaction(upserts);

  return NextResponse.json({ ok: true });
}
