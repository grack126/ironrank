"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createGroupAction,
  joinByCodeAction,
  acceptInviteAction,
  declineInviteAction,
} from "@/app/group-actions";
import { IconBell } from "@/components/ui/icons";

export interface InviteItem { id: string; groupName: string; fromName: string }

export function GroupsPanel({ invites }: { invites: InviteItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    const fd = new FormData(); fd.set("name", name);
    const r = await createGroupAction(fd); // redirects on success
    setBusy(false);
    if (r?.error) setErr(r.error);
  }
  async function join() {
    if (!joinCode.trim()) return;
    setBusy(true); setErr(null);
    const fd = new FormData(); fd.set("code", joinCode);
    const r = await joinByCodeAction(fd);
    setBusy(false);
    if (r?.error) setErr(r.error);
  }

  return (
    <>
      {invites.length > 0 && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <h2 className="sec-title" style={{ marginTop: 0 }}>
            <IconBell className="sec-ico" size={20} strokeWidth={2.25} aria-hidden />
            <span>Invites</span>
          </h2>
          {invites.map((i) => (
            <div key={i.id} className="list-item">
              <div className="grow">
                <h3 style={{ margin: 0 }}>{i.groupName}</h3>
                <span className="ti-meta">from {i.fromName}</span>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn success sm auto" onClick={async () => { const r = await acceptInviteAction(i.id); if (r.ok) router.push(`/groups/${r.groupId}`); else router.refresh(); }}>Accept</button>
                <button className="btn ghost sm auto" onClick={async () => { await declineInviteAction(i.id); router.refresh(); }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Create a group</h2>
        <div className="row" style={{ gap: 6 }}>
          <input className="grow" placeholder="Group name, e.g. Garage Crew" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn sm auto" disabled={busy || !name.trim()} onClick={create}>Create</button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Join with a code</h2>
        <div className="row" style={{ gap: 6 }}>
          <input className="grow" placeholder="Invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
          <button className="btn secondary sm auto" disabled={busy || !joinCode.trim()} onClick={join}>Join</button>
        </div>
      </div>
      {err && <p className="error">{err}</p>}
    </>
  );
}
