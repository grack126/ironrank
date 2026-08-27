import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { GroupManage } from "@/components/GroupManage";
import { ChallengeBoards } from "@/components/ChallengeBoards";
import type { BoardSubmission } from "@/lib/leaderboard";
import { type ChallengeType } from "@/lib/shared/challenge";
import { type Unit } from "@/lib/shared/units";

export default async function GroupDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { id } = await params;
  const { c } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profile) redirect("/onboarding");
  const unit = (user.profile.preferredUnits as Unit) || "kg";

  // Membership gate (RLS stand-in): non-members can't read the group at all.
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: user.id } },
  });
  if (!membership) notFound();

  const group = await prisma.group.findUnique({
    where: { id },
    include: { members: { include: { user: { select: { id: true, profile: true } } }, orderBy: { joinedAt: "asc" } } },
  });
  if (!group) notFound();

  const isOwner = group.ownerId === user.id;
  const memberIds = group.members.map((m) => m.userId);

  const [challenges, weightClasses, experienceClasses] = await Promise.all([
    prisma.challenge.findMany({ where: { status: "published" }, orderBy: { endsAt: "desc" }, select: { id: true, title: true, challengeType: true, scoringType: true, unitLabel: true } }),
    prisma.weightCategory.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
    prisma.experienceClass.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  const selected = challenges.find((ch) => ch.id === c) ?? challenges[0] ?? null;

  let boardSubs: BoardSubmission[] = [];
  if (selected) {
    const subs = await prisma.submission.findMany({
      where: { challengeId: selected.id, userId: { in: memberIds } },
      include: { user: { select: { id: true, profile: true } } },
    });
    boardSubs = subs.map((s) => ({
      userId: s.userId,
      rawValue: s.rawValue,
      bodyweightAtAttemptKg: s.bodyweightAtAttemptKg,
      verificationStatus: s.verificationStatus,
      videoUrl: s.videoUrl,
      displayName: s.user.profile?.displayName ?? "Unknown",
      username: s.user.profile?.username ?? "unknown",
      gender: s.user.profile?.gender ?? "unspecified",
      profileBodyweightKg: s.user.profile?.bodyweightKg ?? null,
      weightClassId: s.weightClassId,
      experienceClassId: s.experienceClassId,
    }));
  }
  const hasVerified = boardSubs.some((s) => s.verificationStatus === "verified");

  return (
    <>
      <TopBar right={<Link href="/groups" className="pill">← Groups</Link>} />
      <h1>{group.name}</h1>
      <p className="muted small">Private to {group.members.length} member{group.members.length === 1 ? "" : "s"}.</p>

      <h2>Group leaderboard</h2>
      {challenges.length === 0 ? (
        <p className="muted small">No challenges to rank yet.</p>
      ) : (
        <>
          <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
            {challenges.slice(0, 6).map((ch) => (
              <Link key={ch.id} href={`/groups/${id}?c=${ch.id}`} className={`pill ${selected?.id === ch.id ? "accent" : ""}`}>
                {ch.title}
              </Link>
            ))}
          </div>
          {selected && (
            boardSubs.length === 0 ? (
              <p className="muted small">No member has entered “{selected.title}” yet.</p>
            ) : (
              <ChallengeBoards
                submissions={boardSubs}
                challengeType={selected.challengeType as ChallengeType}
                unitLabel={selected.unitLabel}
                userUnit={unit}
                currentUserId={user.id}
                weightClasses={weightClasses}
                experienceClasses={experienceClasses}
                hasVerified={hasVerified}
              />
            )
          )}
        </>
      )}

      <GroupManage
        groupId={group.id}
        inviteCode={group.inviteCode}
        isOwner={isOwner}
        members={group.members.map((m) => ({
          userId: m.userId,
          name: m.user.profile?.displayName ?? "Unknown",
          username: m.user.profile?.username ?? "unknown",
          role: m.role,
        }))}
      />
    </>
  );
}
