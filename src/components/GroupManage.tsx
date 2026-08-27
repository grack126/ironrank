"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inviteByRefAction, removeMemberAction, deleteGroupAction } from "@/app/group-actions";

export interface MemberRow { userId: string; name: string; username: string; role: string }

export function GroupManage({
  groupId,
  inviteCode,
  isOwner,
  members,
}: {
  groupId: string;
  inviteCode: string;
  isOwner: boolean;
  members: MemberRow[];
}) {
  const router = useRouter();
  const [ref, setRef] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function invite() {
    if (!ref.trim()) return;
    setBusy(true); setMsg(null);
    const r = await inviteByRefAction(groupId, ref);
    setBusy(false);
    if (!r.ok) setMsg({ kind: "err", text: r.error });
    else { setMsg({ kind: "ok", text: r.existsAsUser ? "Invite sent — they'll see it in their Groups tab." : "Invite created. Share the code below with them." }); setRef(""); router.refresh(); }
  }

  function copyCode() {
    navigator.clipboard?.writeText(inviteCode).then(() => setMsg({ kind: "ok", text: "Code copied." })).catch(() => {});
  }

  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Invite friends</h2>
        <div className="row" style={{ gap: 6 }}>
          <input className="grow" placeholder="username or email" value={ref} onChange={(e) => setRef(e.target.value)} />
          <button className="btn sm auto" disabled={busy || !ref.trim()} onClick={invite}>Invite</button>
        </div>
        <div className="row between" style={{ marginTop: 12 }}>
          <div>
            <div className="tag">Shareable code</div>
            <div className="mono" style={{ fontSize: "var(--fs-20)", fontWeight: 700 }}>{inviteCode}</div>
          </div>
          <button className="btn secondary sm auto" onClick={copyCode}>Copy</button>
        </div>
        {msg && <p className={msg.kind === "ok" ? "ok" : "error"}>{msg.text}</p>}
      </div>

      <h2>Members</h2>
      <div className="card">
        {members.map((m) => (
          <div key={m.userId} className="list-item">
            <div className="grow">
              <h3 style={{ margin: 0 }}>{m.name}</h3>
              <span className="ti-meta">@{m.username}{m.role === "owner" ? " · owner" : ""}</span>
            </div>
            {isOwner && m.role !== "owner" && (
              <button className="btn ghost sm auto" onClick={async () => { await removeMemberAction(groupId, m.userId); router.refresh(); }}>Remove</button>
            )}
          </div>
        ))}
      </div>

      {isOwner && (
        <button
          className="btn danger-ghost"
          style={{ marginBottom: 24 }}
          onClick={async () => { if (confirm("Delete this group for everyone?")) await deleteGroupAction(groupId); }}
        >
          Delete group
        </button>
      )}
    </>
  );
}
