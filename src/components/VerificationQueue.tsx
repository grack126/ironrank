"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifySubmissionAction, rejectSubmissionAction } from "@/app/admin/challenge-actions";
import { IconCheck, IconX, IconSuccess, IconPlay } from "@/components/ui/icons";

export interface QueueItem {
  id: string;
  challengeTitle: string;
  athlete: string;
  rawLabel: string;
  bodyweight: string;
  videoUrl: string | null;
  submittedAt: string;
}

export function VerificationQueue({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  async function approve(id: string) {
    setBusy(id);
    await verifySubmissionAction(id);
    setBusy(null);
    router.refresh();
  }
  async function reject(id: string) {
    setBusy(id);
    await rejectSubmissionAction(id, notes);
    setBusy(null);
    setRejectingId(null);
    setNotes("");
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="empty">
        <div className="ico" aria-hidden><IconSuccess size={40} strokeWidth={1.75} /></div>
        <h3 style={{ color: "var(--text)" }}>Queue clear</h3>
        <p className="muted small">No submissions awaiting review.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      {items.map((it) => (
        <div key={it.id} className="card">
          <div className="row between">
            <div className="grow">
              <h3 style={{ margin: 0 }}>{it.challengeTitle}</h3>
              <span className="ti-meta">{it.athlete} · {it.bodyweight}</span>
            </div>
            <span className="pill accent">{it.rawLabel}</span>
          </div>
          <p className="ti-meta" style={{ margin: "8px 0" }}>Submitted {it.submittedAt}</p>
          {it.videoUrl ? (
            <a href={it.videoUrl} target="_blank" rel="noopener noreferrer" className="btn secondary" style={{ marginBottom: 10 }}>
              <IconPlay size={18} strokeWidth={2.25} aria-hidden />Open video proof
            </a>
          ) : (
            <p className="banner">No video attached — verify only if you can otherwise confirm.</p>
          )}

          {rejectingId === it.id ? (
            <div className="stack-2">
              <textarea placeholder="Reason (shown to the athlete)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              <div className="grid2">
                <button className="btn danger-ghost" disabled={busy === it.id} onClick={() => reject(it.id)}>Confirm reject</button>
                <button className="btn ghost" onClick={() => { setRejectingId(null); setNotes(""); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="grid2">
              <button className="btn success" disabled={busy === it.id} onClick={() => approve(it.id)}>
                {busy === it.id ? "…" : <><IconCheck size={18} strokeWidth={2.5} aria-hidden />Verify</>}
              </button>
              <button className="btn danger-ghost" disabled={busy === it.id} onClick={() => setRejectingId(it.id)}>
                <IconX size={18} strokeWidth={2.5} aria-hidden />Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
