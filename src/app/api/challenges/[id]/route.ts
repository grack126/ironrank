import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";
import { formatRawValue, type ChallengeType } from "@/lib/shared/challenge";
import type { BoardSubmission } from "@/lib/leaderboard";

// Challenge detail for mobile: metadata, raw board submissions (the client builds
// the ranked boards with the shared buildBoard), the user's own entries, and the
// weight/experience class options for filtering.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await params;

  const [challenge, weightClasses, experienceClasses] = await Promise.all([
    prisma.challenge.findUnique({
      where: { id },
      include: {
        exercise: true,
        season: { select: { name: true } },
        submissions: {
          // Narrow to exactly the BoardSubmission fields — no full profile rows.
          select: {
            id: true,
            userId: true,
            rawValue: true,
            bodyweightAtAttemptKg: true,
            verificationStatus: true,
            verificationNotes: true,
            videoUrl: true,
            videoIsPublic: true,
            createdAt: true,
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
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.weightCategory.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
    prisma.experienceClass.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!challenge || !["published", "closed"].includes(challenge.status)) {
    return NextResponse.json({ error: "Challenge not available" }, { status: 404 });
  }

  const type = challenge.challengeType as ChallengeType;
  const now = new Date();
  const open = challenge.status === "published" && now >= challenge.startsAt && now <= challenge.endsAt;

  // Video visibility: admins always see the link; others only when the athlete
  // marked it public. Gate here so the client just shows a link when present.
  const submissions: BoardSubmission[] = challenge.submissions.map((s) => ({
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

  const myEntries = challenge.submissions
    .filter((s) => s.userId === user.id)
    .map((s) => ({
      id: s.id,
      label: formatRawValue(s.rawValue, type, challenge.unitLabel),
      createdAt: s.createdAt.toISOString(),
      status: s.verificationStatus,
      notes: s.verificationNotes ?? null,
      videoUrl: s.videoUrl,
      videoIsPublic: s.videoIsPublic,
    }));

  return NextResponse.json({
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    exercise: challenge.exercise.name,
    challengeType: type,
    scoringType: challenge.scoringType,
    unitLabel: challenge.unitLabel,
    isDaily: challenge.isDaily,
    season: challenge.season?.name ?? null,
    open,
    finalized: !!challenge.finalizedAt,
    movementStandard: challenge.movementStandard ?? challenge.exercise.movementStandard ?? null,
    demoYoutubeVideoId: challenge.demoYoutubeVideoId ?? challenge.exercise.youtubeVideoId ?? null,
    backgroundImagePath: challenge.backgroundImagePath,
    defaultBodyweightKg: user.profile?.bodyweightKg ?? null,
    currentUserId: user.id,
    submissions,
    myEntries,
    weightClasses,
    experienceClasses,
  });
}
