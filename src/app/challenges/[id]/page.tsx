import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { VideoEmbed } from "@/components/ui/VideoEmbed";
import { ChallengeBoards } from "@/components/ChallengeBoards";
import { ChallengeSubmitForm } from "@/components/ChallengeSubmitForm";
import { isWeightBased, formatRawValue, type ChallengeType } from "@/lib/shared/challenge";
import type { BoardSubmission } from "@/lib/leaderboard";
import { type Unit } from "@/lib/shared/units";
import { IconDaily, IconCheck } from "@/components/ui/icons";

const STATUS_LABEL: Record<string, string> = {
  verified: "Verified",
  pending: "Pending review",
  unverified: "Unverified",
  rejected: "Rejected",
};

export default async function ChallengeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profile) redirect("/onboarding");
  const unit = (user.profile.preferredUnits as Unit) || "kg";

  const [challenge, weightClasses, experienceClasses] = await Promise.all([
    prisma.challenge.findUnique({
      where: { id },
      include: {
        exercise: true,
        season: { select: { name: true } },
        submissions: {
          include: { user: { select: { id: true, profile: { include: { avatar: { select: { assetRef: true } } } } } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.weightCategory.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
    prisma.experienceClass.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!challenge || !["published", "closed"].includes(challenge.status)) notFound();

  const type = challenge.challengeType as ChallengeType;
  const weightBased = isWeightBased(type);
  const now = new Date();
  const open = challenge.status === "published" && now >= challenge.startsAt && now <= challenge.endsAt;
  const finalized = !!challenge.finalizedAt;
  const demoVideoId = challenge.demoYoutubeVideoId ?? challenge.exercise.youtubeVideoId;

  const boardSubs: BoardSubmission[] = challenge.submissions.map((s) => ({
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
    avatar: s.user.profile?.avatar?.assetRef ?? undefined,
  }));
  const hasVerified = boardSubs.some((s) => s.verificationStatus === "verified");

  const myEntries = challenge.submissions.filter((s) => s.userId === user.id);
  const standard = challenge.movementStandard ?? challenge.exercise.movementStandard;

  return (
    <>
      <TopBar right={<Link href="/challenges" className="pill">← Challenges</Link>} />
      <h1 className="sec-title">
        {challenge.isDaily && <IconDaily className="sec-ico" size={26} strokeWidth={2.25} aria-label="Daily challenge" />}
        <span>{challenge.title}</span>
      </h1>
      <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
        <span className="pill">{challenge.exercise.name}</span>
        <span className="pill">{type.replace("_", " ")}</span>
        {challenge.scoringType === "relative_dots" && <span className="pill accent">DOTS</span>}
        {challenge.season && <span className="pill">{challenge.season.name}</span>}
        <span className={`pill ${open ? "success" : ""}`}>{open ? "open" : "closed"}</span>
      </div>
      {challenge.description && <p className="muted small">{challenge.description}</p>}
      {standard && <p className="tiny faint">Standard: {standard}</p>}

      {demoVideoId && (
        <details style={{ marginBottom: 14 }}>
          <summary className="small muted" style={{ cursor: "pointer" }}>Watch demo</summary>
          <div style={{ marginTop: 8 }}>
            <VideoEmbed videoId={demoVideoId} />
          </div>
        </details>
      )}

      <h2>Log your attempt</h2>
      <div className="card">
        <ChallengeSubmitForm
          challengeId={challenge.id}
          challengeType={type}
          weightBased={weightBased}
          unitLabel={challenge.unitLabel}
          userUnit={unit}
          defaultBodyweightKg={user.profile.bodyweightKg}
          open={open}
        />
      </div>

      {myEntries.length > 0 && (
        <>
          <h2>Your entries</h2>
          <div className="card">
            {myEntries.map((s) => (
              <div key={s.id} className="list-item">
                <div className="grow">
                  <h3 style={{ margin: 0 }}>{formatRawValue(s.rawValue, type, challenge.unitLabel)}</h3>
                  <span className="ti-meta">{s.createdAt.toLocaleDateString()}</span>
                </div>
                <span className={`pill ${s.verificationStatus === "verified" ? "success" : s.verificationStatus === "rejected" ? "danger" : ""}`}>
                  {STATUS_LABEL[s.verificationStatus]}
                </span>
              </div>
            ))}
            {myEntries.some((s) => s.verificationStatus === "rejected" && s.verificationNotes) && (
              <p className="tiny faint" style={{ marginTop: 8 }}>
                Rejection note: {myEntries.find((s) => s.verificationNotes)?.verificationNotes}
              </p>
            )}
          </div>
        </>
      )}

      <h2>Leaderboard</h2>
      {finalized ? (
        <p className="small row" style={{ color: "var(--success)", marginTop: 0, gap: 6 }}>
          <IconCheck size={16} strokeWidth={2.5} aria-hidden />
          <span>Final standings — placement badges have been awarded.</span>
        </p>
      ) : (
        <div className="banner info">Provisional standings — placements & badges are finalized once the challenge closes.</div>
      )}
      <ChallengeBoards
        submissions={boardSubs}
        challengeType={type}
        unitLabel={challenge.unitLabel}
        userUnit={unit}
        currentUserId={user.id}
        weightClasses={weightClasses}
        experienceClasses={experienceClasses}
        hasVerified={hasVerified}
      />
    </>
  );
}
