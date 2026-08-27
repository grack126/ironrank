import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProfileForm } from "@/components/ProfileForm";
import { PasswordForm } from "@/components/PasswordForm";
import { TabBar } from "@/components/TabBar";
import { TopBar } from "@/components/TopBar";
import { RankBadge } from "@/components/ui/RankBadge";
import { AvatarPicker } from "@/components/AvatarPicker";
import { logoutAction } from "../auth-actions";
import { displayWeight, type Unit } from "@/lib/shared/units";
import { xpIntoLevel } from "@/lib/shared/progression";
import { formatRawValue, ordinal, type ChallengeType } from "@/lib/shared/challenge";
import { ExpandableList } from "@/components/ui/ExpandableList";
import {
  SectionTitle,
  IconStreak,
  IconFreeze,
  IconChallenge,
  IconRank,
  IconProfile,
  IconLock,
} from "@/components/ui/icons";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profile) redirect("/onboarding");

  const p = user.profile;
  const unit = (p.preferredUnits as Unit) || "kg";

  const [classProfile, weightClasses, experienceClasses, avatars, streak, mySubs, pointsLog] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id }, include: { weightClass: true, experienceClass: true, avatar: true } }),
    prisma.weightCategory.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true, gender: true } }),
    prisma.experienceClass.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
    prisma.avatar.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.streak.findUnique({ where: { userId: user.id } }),
    // Challenge history: every non-rejected entry, plus the awarded placements.
    prisma.submission.findMany({
      where: { userId: user.id, verificationStatus: { not: "rejected" } },
      include: {
        challenge: { select: { id: true, title: true, challengeType: true, unitLabel: true, endsAt: true, finalizedAt: true } },
      },
    }),
    prisma.challengePointsLog.findMany({
      where: { userId: user.id },
      include: { weightClass: { select: { name: true } } },
    }),
  ]);
  const expName = classProfile?.experienceClass?.name ?? "—";
  const weightName = classProfile?.weightClass?.name ?? "—";
  // Avatars are admin-authored emoji (DB data); fall back to a Lucide icon.
  const avatarGlyph = classProfile?.avatar?.assetRef ?? null;
  const { into, span } = xpIntoLevel(p.xp);

  // Best completed attempt per workout -> the rank shown on the profile.
  const attempts = await prisma.workoutAttempt.findMany({
    where: { userId: user.id, status: "completed" },
    include: { workout: true, achievedRankTier: true },
    orderBy: [{ totalPoints: "desc" }],
  });
  const bestByWorkout = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) {
    if (!bestByWorkout.has(a.workoutId)) bestByWorkout.set(a.workoutId, a);
  }
  const ranks = [...bestByWorkout.values()];

  // Best challenge results: the user's top-scoring entry per challenge (computedScore
  // is already normalised so higher = better), newest challenge first.
  const bestByChallenge = new Map<string, (typeof mySubs)[number]>();
  for (const s of mySubs) {
    const cur = bestByChallenge.get(s.challengeId);
    if (!cur || s.computedScore > cur.computedScore) bestByChallenge.set(s.challengeId, s);
  }
  const placementByChallenge = new Map(pointsLog.map((l) => [l.challengeId, l]));
  const challengeResults = [...bestByChallenge.values()].sort(
    (a, b) =>
      (b.challenge.finalizedAt ?? b.challenge.endsAt).getTime() -
      (a.challenge.finalizedAt ?? a.challenge.endsAt).getTime()
  );

  return (
    <>
      <TopBar />
      <div className="row between">
        <div>
          <h1 style={{ marginBottom: 0 }}>{p.displayName}</h1>
          <p className="muted small">@{p.username}</p>
        </div>
        <div style={{ fontSize: 44, lineHeight: 1 }}>
          {avatarGlyph ?? <IconProfile className="i-accent" size={44} strokeWidth={1.75} aria-hidden />}
        </div>
      </div>

      <div className="card">
        <div className="grid3">
          <div className="stat">
            <div className="v">{p.level}</div>
            <div className="l">Level</div>
          </div>
          <div className="stat">
            <div className="v">{p.xp.toLocaleString()}</div>
            <div className="l">XP</div>
          </div>
          <div className="stat">
            <div className="v">{p.challengePointsTotal.toLocaleString()}</div>
            <div className="l">Challenge Pts</div>
          </div>
        </div>
        <div className="divider" />
        <div className="row between small muted">
          <span>Weight class</span>
          <span>{weightName}</span>
        </div>
        <div className="row between small muted">
          <span>Experience class</span>
          <span>{expName}</span>
        </div>
        <div className="row between small muted">
          <span>Bodyweight</span>
          <span>{p.bodyweightKg != null ? displayWeight(p.bodyweightKg, unit) : "—"}</span>
        </div>
        <div className="row between small muted">
          <span>Height</span>
          <span>{p.heightCm != null ? `${p.heightCm} cm` : "—"}</span>
        </div>
        <div className="divider" />
        <div className="row between small muted" style={{ marginBottom: 6 }}>
          <span>Level {p.level} progress</span>
          <span className="mono">{into} / {span} xp</span>
        </div>
        <div className="progress"><span style={{ width: `${(into / span) * 100}%` }} /></div>
      </div>

      <SectionTitle icon={IconStreak}>Streak</SectionTitle>
      <div className="card streak-card">
        <span className={`streak-flame${(streak?.currentStreak ?? 0) > 0 ? "" : " cold"}`} aria-hidden>
          <IconStreak size={44} strokeWidth={1.75} />
        </span>
        <div className="grid3 grow">
          <div className="stat"><div className="v">{streak?.currentStreak ?? 0}</div><div className="l">Current</div></div>
          <div className="stat"><div className="v">{streak?.longestStreak ?? 0}</div><div className="l">Longest</div></div>
          <div className="stat">
            <div className="v stat-icon-v">
              {streak?.freezeTokens ?? 0}
              <IconFreeze className="i-accent" size={18} strokeWidth={2.25} aria-hidden />
            </div>
            <div className="l">Freezes</div>
          </div>
        </div>
      </div>

      <SectionTitle icon={IconChallenge}>Best challenge results</SectionTitle>
      {challengeResults.length === 0 ? (
        <p className="muted small">No challenge results yet — enter a challenge to get on the board.</p>
      ) : (
        <div className="card">
          <ExpandableList>
            {challengeResults.map((s) => {
              const log = placementByChallenge.get(s.challengeId);
              const closedAt = s.challenge.finalizedAt ?? (s.challenge.endsAt < new Date() ? s.challenge.endsAt : null);
              return (
                <div key={s.challengeId} className="list-item">
                  <div className="grow">
                    <h3 style={{ margin: 0 }}>{s.challenge.title}</h3>
                    <span className="ti-meta">
                      {log ? `${ordinal(log.placement)} in ${log.weightClass.name}` : "Awaiting final standings"}
                      {closedAt ? ` · ${closedAt.toLocaleDateString()}` : ""}
                    </span>
                  </div>
                  <span className="pill accent mono">
                    {formatRawValue(s.rawValue, s.challenge.challengeType as ChallengeType, s.challenge.unitLabel)}
                  </span>
                </div>
              );
            })}
          </ExpandableList>
        </div>
      )}

      <SectionTitle icon={IconRank}>Workout ranks</SectionTitle>
      {ranks.length === 0 ? (
        <p className="muted small">
          No ranks yet — complete a workout to earn your first rank.
        </p>
      ) : (
        <div className="card">
          <ExpandableList>
            {ranks.map((a) => (
              <div key={a.id} className="list-item">
                <div className="grow">
                  <h3 style={{ margin: 0 }}>{a.workout.title}</h3>
                  <span className="ti-meta">{a.totalPoints} pts</span>
                </div>
                {a.achievedRankTier ? (
                  <RankBadge name={a.achievedRankTier.name} index={a.achievedRankTier.displayOrder} />
                ) : (
                  <span className="pill">Unranked</span>
                )}
              </div>
            ))}
          </ExpandableList>
        </div>
      )}

      <h2>Avatar</h2>
      <div className="card">
        <AvatarPicker
          avatars={avatars.map((a) => ({ id: a.id, name: a.name, assetRef: a.assetRef, unlockLevel: a.unlockLevel }))}
          selectedId={classProfile?.avatarId ?? null}
          level={p.level}
        />
      </div>

      <h2>Edit profile</h2>
      <div className="card">
        <ProfileForm
          weightClasses={weightClasses}
          experienceClasses={experienceClasses}
          initial={{
            displayName: p.displayName,
            gender: p.gender,
            heightCm: p.heightCm,
            bodyweightKg: p.bodyweightKg,
            experienceYears: p.experienceYears,
            weightClassId: classProfile?.weightClassId ?? null,
            experienceClassId: classProfile?.experienceClassId ?? null,
            preferredUnits: p.preferredUnits,
          }}
        />
      </div>

      <SectionTitle icon={IconLock}>Password</SectionTitle>
      <div className="card">
        <PasswordForm />
      </div>

      <form action={logoutAction} style={{ marginBottom: 24 }}>
        <button type="submit" className="btn ghost">Log out</button>
      </form>

      <TabBar isAdmin={user.isAdmin} />
    </>
  );
}
