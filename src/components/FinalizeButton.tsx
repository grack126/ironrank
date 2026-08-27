"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { finalizeDueChallengesAction } from "@/app/admin/challenge-actions";

export function FinalizeButton({ dueCount }: { dueCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    const r = await finalizeDueChallengesAction();
    setBusy(false);
    setMsg(r.count > 0 ? `Finalized ${r.count} challenge${r.count === 1 ? "" : "s"} and awarded placement badges.` : "No challenges were due for finalization.");
    router.refresh();
  }

  return (
    <div className="card">
      <div className="row between">
        <div>
          <h3 style={{ margin: 0 }}>Finalize ended challenges</h3>
          <span className="ti-meta">
            {dueCount > 0 ? `${dueCount} ended and awaiting finalization` : "Nothing due right now"} · runs on a schedule in production
          </span>
        </div>
        <button className="btn sm auto" onClick={run} disabled={busy || dueCount === 0}>
          {busy ? "Finalizing…" : "Run now"}
        </button>
      </div>
      {msg && <p className="ok" style={{ marginBottom: 0 }}>{msg}</p>}
    </div>
  );
}
