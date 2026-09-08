"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetAllScoresAction, resetUserScoresAction, type WipeCounts } from "@/app/admin/score-actions";
import { IconWarn, IconDelete } from "@/components/ui/icons";

export interface ScoreRow {
  userId: string;
  username: string;
  displayName: string;
  xp: number;
  level: number;
  challengePoints: number;
  attempts: number;
  submissions: number;
}

const summarise = (c: WipeCounts) =>
  `${c.profilesReset} profile${c.profilesReset === 1 ? "" : "s"} reset · ` +
  `${c.workoutAttempts} workout attempts, ${c.submissions} challenge entries, ` +
  `${c.challengePoints} points rows, ${c.badges} badges, ${c.personalRecords} PRs, ${c.streaks} streaks removed`;

export function ScoreResetPanel({ rows }: { rows: ScoreRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askUser, setAskUser] = useState<string | null>(null);

  function resetAll() {
    setMsg(null);
    startTransition(async () => {
      const res = await resetAllScoresAction(confirm.trim());
      if (!res.ok) return setMsg({ ok: false, text: res.error });
      setConfirm("");
      setMsg({ ok: true, text: `Leaderboard reset — ${summarise(res.counts)}.` });
      router.refresh();
    });
  }

  function resetOne(userId: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await resetUserScoresAction(userId);
      setAskUser(null);
      if (!res.ok) return setMsg({ ok: false, text: res.error });
      setMsg({ ok: true, text: `@${res.username} wiped — ${summarise(res.counts)}.` });
      router.refresh();
    });
  }

  const totals = rows.reduce(
    (a, r) => ({
      xp: a.xp + r.xp,
      cp: a.cp + r.challengePoints,
      att: a.att + r.attempts,
      sub: a.sub + r.submissions,
    }),
    { xp: 0, cp: 0, att: 0, sub: 0 }
  );

  return (
    <>
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.text}</p>}

      {/* ---- per-athlete ---- */}
      <div className="card">
        {rows.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No athletes yet.</p>
        ) : (
          rows.map((r) => (
            <div key={r.userId} className="list-item">
              <div className="grow">
                <h3 style={{ margin: 0 }}>{r.displayName}</h3>
                <span className="ti-meta">
                  @{r.username} · Lv {r.level} · {r.xp.toLocaleString()} xp · {r.challengePoints} pts ·{" "}
                  {r.attempts} attempts · {r.submissions} entries
                </span>
              </div>
              {askUser === r.userId ? (
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn danger-ghost sm auto" disabled={pending} onClick={() => resetOne(r.userId)}>
                    {pending ? "…" : "Confirm wipe"}
                  </button>
                  <button className="btn ghost sm auto" disabled={pending} onClick={() => setAskUser(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button className="btn ghost sm auto" disabled={pending} onClick={() => setAskUser(r.userId)}>
                  <IconDelete size={15} strokeWidth={2.25} aria-hidden />
                  Wipe scores
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* ---- everyone ---- */}
      <h2>Reset the whole leaderboard</h2>
      <div className="card" style={{ borderColor: "var(--danger)" }}>
        <p className="row" style={{ gap: 8, alignItems: "flex-start" }}>
          <IconWarn className="i-danger" size={18} strokeWidth={2.25} aria-hidden />
          <span className="small">
            Wipes scores for <strong>all {rows.length} athletes</strong> — currently{" "}
            {totals.xp.toLocaleString()} xp, {totals.cp} challenge points, {totals.att} workout attempts and{" "}
            {totals.sub} challenge entries. Accounts, workouts and challenges are kept. This cannot be undone.
          </span>
        </p>
        <label htmlFor="confirm-reset">Type RESET to confirm</label>
        <input
          id="confirm-reset"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="RESET"
          autoComplete="off"
        />
        <button
          className="btn danger-ghost"
          style={{ marginTop: 10 }}
          disabled={pending || confirm.trim() !== "RESET"}
          onClick={resetAll}
        >
          {pending ? "Resetting…" : "Reset all scores"}
        </button>
      </div>
    </>
  );
}
