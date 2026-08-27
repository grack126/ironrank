"use client";
import { useMemo, useState } from "react";
import { buildBoard, type BoardSubmission } from "@/lib/leaderboard";
import { isWeightBased, type ChallengeType } from "@/lib/shared/challenge";
import { displayWeight, type Unit } from "@/lib/shared/units";
import { IconVerified } from "@/components/ui/icons";

export interface ChallengeBoardsProps {
  submissions: BoardSubmission[];
  challengeType: ChallengeType;
  unitLabel: string;
  userUnit: Unit;
  currentUserId: string;
  weightClasses: { id: string; name: string }[];
  experienceClasses: { id: string; name: string }[];
  hasVerified: boolean;
}

export function ChallengeBoards({
  submissions,
  challengeType,
  unitLabel,
  userUnit,
  currentUserId,
  weightClasses,
  experienceClasses,
  hasVerified,
}: ChallengeBoardsProps) {
  const weightBased = isWeightBased(challengeType);
  const [verifiedOnly, setVerifiedOnly] = useState(hasVerified);
  const [view, setView] = useState<"absolute" | "relative">("absolute");
  const [weightClassId, setWeightClassId] = useState("");
  const [experienceClassId, setExperienceClassId] = useState("");

  const rows = useMemo(
    () =>
      buildBoard(submissions, {
        view: weightBased ? view : "absolute",
        challengeType,
        verifiedOnly,
        weightClassId: weightClassId || null,
        experienceClassId: experienceClassId || null,
      }),
    [submissions, view, weightBased, challengeType, verifiedOnly, weightClassId, experienceClassId]
  );

  const inView = rows.some((r) => r.userId === currentUserId);
  const myRow = rows.find((r) => r.userId === currentUserId);
  const filtering = weightClassId !== "" || experienceClassId !== "";

  function scoreCell(rawValue: number, comparable: number) {
    const raw = weightBased ? displayWeight(rawValue, userUnit) : `${Math.round(rawValue * 100) / 100} ${unitLabel}`;
    if (view === "relative" && weightBased) {
      return (<>{raw}<span className="ti-meta"> · {Math.round(comparable * 10) / 10} DOTS</span></>);
    }
    return raw;
  }

  return (
    <div>
      <div className="stack-2" style={{ marginBottom: 12 }}>
        <div className="segmented" role="tablist" aria-label="Board verification">
          <button className={verifiedOnly ? "active" : ""} onClick={() => setVerifiedOnly(true)}>Official</button>
          <button className={!verifiedOnly ? "active" : ""} onClick={() => setVerifiedOnly(false)}>All entries</button>
        </div>
        {weightBased && (
          <div className="segmented">
            <button className={view === "absolute" ? "active" : ""} onClick={() => setView("absolute")}>Absolute</button>
            <button className={view === "relative" ? "active" : ""} onClick={() => setView("relative")}>Relative</button>
          </div>
        )}
        <div className="grid2">
          <select aria-label="Weight class filter" value={weightClassId} onChange={(e) => setWeightClassId(e.target.value)}>
            <option value="">All weight classes</option>
            {weightClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="Experience class filter" value={experienceClassId} onChange={(e) => setExperienceClassId(e.target.value)}>
            <option value="">All experience</option>
            {experienceClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="pill">{filtering ? "Filtered" : "Overall"}</span>
          {weightClassId && <span className="pill accent">{weightClasses.find((c) => c.id === weightClassId)?.name}</span>}
          {experienceClassId && <span className="pill accent">{experienceClasses.find((c) => c.id === experienceClassId)?.name}</span>}
          {filtering && (
            <button className="btn ghost sm auto" onClick={() => { setWeightClassId(""); setExperienceClassId(""); }}>Clear</button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="muted small">
          {verifiedOnly ? "No verified entries match — try All entries or clear filters." : "No entries match. Log the first attempt."}
        </p>
      ) : (
        <div className="card">
          <table className="board">
            <thead>
              <tr>
                <th className="rk">#</th>
                <th>Athlete</th>
                <th className="pts">{view === "relative" && weightBased ? "Score" : "Result"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className={r.userId === currentUserId ? "me" : ""}>
                  <td className="rk">{r.rank}</td>
                  <td>
                    <div className="athlete-cell">
                      <span className="avatar-sm" aria-hidden>{r.avatar}</span>
                      <div className="who">
                        <div style={{ fontWeight: 500 }}>
                          {r.displayName}
                          {r.verificationStatus === "verified" && (
                            <IconVerified className="i-success" size={15} strokeWidth={2.5} aria-label="Verified" style={{ marginLeft: 4, verticalAlign: "-0.15em" }} />
                          )}
                        </div>
                        <div className="ti-meta">@{r.username}{r.bodyweightKg != null ? ` · ${displayWeight(r.bodyweightKg, userUnit)}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="pts">{scoreCell(r.rawValue, r.comparable)}</td>
                </tr>
              ))}
              {!inView && myRow && (
                <tr className="me">
                  <td className="rk">{myRow.rank}</td>
                  <td>
                    <div className="athlete-cell">
                      <span className="avatar-sm" aria-hidden>{myRow.avatar}</span>
                      <div className="who">
                        <div style={{ fontWeight: 500 }}>{myRow.displayName} · you</div>
                        <div className="ti-meta">@{myRow.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="pts">{scoreCell(myRow.rawValue, myRow.comparable)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
