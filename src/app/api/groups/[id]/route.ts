import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";
import type { BoardSubmission } from "@/lib/leaderboard";

// Group detail (members-only). Returns members, the challenge picker, and the raw
// board submissions for the selected challenge (?c=), restricted to group members.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await params;
  const c = new URL(req.url).searchParams.get("c");

  // Membership gate (RLS stand-in): non-members can't read the group at all.
  const membership = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: id, userId: user.id } } });
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { profile: { select: { displayName: true, username: true } } } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const memberIds = group.members.map((m) => m.userId);
  const [challenges, weightClasses, experienceClasses] = await Promise.all([
    prisma.challenge.findMany({ where: { status: "published" }, orderBy: { endsAt: "desc" }, select: { id: true, title: true, challengeType: true, scoringType: true, unitLabel: true } }),
    prisma.weightCategory.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
    prisma.experienceClass.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  const selected = challenges.find((ch) => ch.id === c) ?? challenges[0] ?? null;

  let submissions: BoardSubmission[] = [];
  if (selected) {
    const subs = await prisma.submission.findMany({
      where: { challengeId: selected.id, userId: { in: memberIds } },
      // Narrow to exactly the BoardSubmission fields — no full profile rows.
      select: {
        userId: true,
        rawValue: true,
        bodyweightAtAttemptKg: true,
        verificationStatus: true,
        videoUrl: true,
        videoIsPublic: true,
        weightClassId: true,
        experienceClassId: true,
        user: {
          select: {
            profile: {
              select: { displayName: true, username: true, gender: true, bodyweightKg: true, avatar: { select: { assetRef: true } } },
            },
          },
        },
      },
    });
    submissions = subs.map((s) => ({
      userId: s.userId,
      rawValue: s.rawValue,
      bodyweightAtAttemptKg: s.bodyweightAtAttemptKg,
      verificationStatus: s.verificationStatus,
      videoUrl: user.isAdmin || s.videoIsPublic ? s.videoUrl : null,
      displayName: s.user.profile?.displayName ?? "Unknown",
      username: s.user.profile?.username ?? "unknown",
      gender: s.user.profile?.gender ?? "unspecified",
      profileBodyweightKg: s.user.profile?.bodyweightKg ?? null,
      weightClassId: s.weightClassId,
      experienceClassId: s.experienceClassId,
      avatar: s.user.profile?.avatar?.assetRef ?? "🧍",
    }));
  }

  return NextResponse.json({
    id: group.id,
    name: group.name,
    inviteCode: group.inviteCode,
    isOwner: group.ownerId === user.id,
    currentUserId: user.id,
    members: group.members.map((m) => ({
      userId: m.userId,
      name: m.user.profile?.displayName ?? "Unknown",
      username: m.user.profile?.username ?? "unknown",
      role: m.role,
    })),
    challenges,
    selectedChallengeId: selected?.id ?? null,
    weightClasses,
    experienceClasses,
    submissions,
  });
}

// DELETE: owner deletes the group.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await params;

  const group = await prisma.group.findUnique({ where: { id } });
  if (!group || group.ownerId !== user.id) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  await prisma.group.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
