import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiAdmin } from "@/lib/api-auth";
import { isPrismaNotFound } from "@/lib/api-errors";

// Guarded delete: hard-delete if unused by any workout, otherwise archive.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;

  const used = await prisma.workout.count({ where: { categoryId: id } });
  try {
    if (used > 0) {
      await prisma.workoutCategory.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ ok: true, archived: true });
    }
    await prisma.workoutCategory.delete({ where: { id } });
  } catch (e) {
    if (isPrismaNotFound(e)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
  return NextResponse.json({ ok: true, archived: false });
}
