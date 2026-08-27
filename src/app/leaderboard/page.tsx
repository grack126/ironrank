import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TabBar } from "@/components/TabBar";
import { TopBar } from "@/components/TopBar";
import { Card, StatNumber } from "@/components/ui/primitives";
import { RankingSelect } from "@/components/RankingSelect";
import { SectionTitle, IconBoard, IconProfile } from "@/components/ui/icons";

// Ranking types shown in the dropdown. Extensible — add an entry + a branch in
// `orderBy`/`score` below to introduce a new board without reworking the UI.
const RANKINGS = [
  { value: "xp", label: "XP", column: "XP" },
  { value: "points", label: "Challenge Points", column: "Points" },
] as const;
type Mode = (typeof RANKINGS)[number]["value"];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profile) redirect("/onboarding");

  const raw = (await searchParams)?.mode;
  const mode: Mode = raw === "points" ? "points" : "xp";
  const active = RANKINGS.find((r) => r.value === mode)!;

  const orderBy =
    mode === "points"
      ? [{ challengePointsTotal: "desc" as const }, { createdAt: "asc" as const }]
      : [{ xp: "desc" as const }, { createdAt: "asc" as const }];

  const profiles = await prisma.profile.findMany({
    orderBy,
    select: {
      userId: true,
      username: true,
      displayName: true,
      xp: true,
      level: true,
      challengePointsTotal: true,
      avatar: { select: { assetRef: true } },
    },
  });

  const ranked = profiles.map((p, i) => ({ ...p, rank: i + 1 }));
  const meRow = ranked.find((r) => r.userId === user.id);
  const top = ranked.slice(0, 25);
  const meInTop = top.some((r) => r.userId === user.id);
  const score = (r: (typeof ranked)[number]) => (mode === "points" ? r.challengePointsTotal : r.xp);

  return (
    <>
      <TopBar right={<RankingSelect options={RANKINGS.map((r) => ({ value: r.value, label: r.label }))} value={mode} />} />
      <SectionTitle as="h1" icon={IconBoard}>Leaderboard</SectionTitle>
      <p className="muted small">
        {mode === "points"
          ? "All-time Challenge Points — earned by placing top 50 in your weight class on finalized challenges."
          : "Overall standings by XP."}
      </p>

      <Card variant="surface-2">
        <div className="grid3">
          <StatNumber value={meRow ? `#${meRow.rank}` : "—"} label="Your rank" />
          <StatNumber value={(meRow ? score(meRow) : 0).toLocaleString()} label={`Your ${active.column}`} />
          <StatNumber value={ranked.length} label="Athletes" />
        </div>
      </Card>

      <div className="card">
        <table className="board">
          <thead>
            <tr>
              <th className="rk">#</th>
              <th>Athlete</th>
              {mode === "xp" && <th>Level</th>}
              <th className="pts">{active.column}</th>
            </tr>
          </thead>
          <tbody>
            {top.map((r) => (
              <tr key={r.userId} className={r.userId === user.id ? "me" : ""}>
                <td className="rk">{r.rank}</td>
                <td>
                  <div className="athlete-cell">
                    <span className="avatar-sm" aria-hidden>{r.avatar?.assetRef ?? <IconProfile size={18} strokeWidth={2} />}</span>
                    <div className="who">
                      <div style={{ fontWeight: 500 }}>{r.displayName}</div>
                      <div className="ti-meta">@{r.username}</div>
                    </div>
                  </div>
                </td>
                {mode === "xp" && <td className="muted">Lv {r.level}</td>}
                <td className="pts">{score(r).toLocaleString()}</td>
              </tr>
            ))}
            {!meInTop && meRow && (
              <tr className="me">
                <td className="rk">{meRow.rank}</td>
                <td>
                  <div className="athlete-cell">
                    <span className="avatar-sm" aria-hidden>{meRow.avatar?.assetRef ?? <IconProfile size={18} strokeWidth={2} />}</span>
                    <div className="who">
                      <div style={{ fontWeight: 500 }}>{meRow.displayName}</div>
                      <div className="ti-meta">@{meRow.username} · you</div>
                    </div>
                  </div>
                </td>
                {mode === "xp" && <td className="muted">Lv {meRow.level}</td>}
                <td className="pts">{score(meRow).toLocaleString()}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TabBar isAdmin={user.isAdmin} />
    </>
  );
}
