"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createReferenceLift,
  updateReferenceLift,
  setReferenceLiftStatus,
  deleteReferenceLift,
} from "@/app/admin/admin-actions";
import { IconX } from "@/components/ui/icons";

export interface RefLiftItem {
  id: string;
  name: string;
  description: string;
  unit: string;
  status: string;
  usage: number;
}

export function ReferenceLiftManager({ lifts }: { lifts: RefLiftItem[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState({ name: "", unit: "kg", description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", unit: "kg", description: "" });

  async function create() {
    if (!creating.name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await createReferenceLift(creating);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setCreating({ name: "", unit: "kg", description: "" });
    router.refresh();
  }

  function startEdit(l: RefLiftItem) {
    setEditId(l.id);
    setEdit({ name: l.name, unit: l.unit, description: l.description });
  }
  async function saveEdit(id: string) {
    setBusy(true);
    setError(null);
    const res = await updateReferenceLift({ id, ...edit });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setEditId(null);
    router.refresh();
  }
  async function toggleStatus(l: RefLiftItem) {
    await setReferenceLiftStatus(l.id, l.status === "active" ? "archived" : "active");
    router.refresh();
  }
  async function remove(l: RefLiftItem) {
    const res = await deleteReferenceLift(l.id);
    if (res.archived) setError(`"${l.name}" is used by workouts or athletes, so it was archived instead of deleted.`);
    router.refresh();
  }

  const active = lifts.filter((l) => l.status === "active");
  const archived = lifts.filter((l) => l.status !== "active");

  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Add a reference lift</h2>
        <div className="stack-2">
          <input placeholder="Bench Press 10RM" value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} />
          <div className="row" style={{ gap: 6 }}>
            <select style={{ width: 90 }} value={creating.unit} onChange={(e) => setCreating({ ...creating, unit: e.target.value })}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
            <input className="grow" placeholder="Short description (optional)" value={creating.description} onChange={(e) => setCreating({ ...creating, description: e.target.value })} />
          </div>
          <button className="btn auto" onClick={create} disabled={busy || !creating.name.trim()}>
            {busy ? "Adding…" : "Add reference lift"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Catalogue</h2>
        {active.length === 0 && <p className="muted small">No active reference lifts.</p>}
        {active.map((l) => (
          <div key={l.id} style={{ borderBottom: "1px solid var(--border)", padding: "10px 0" }}>
            {editId === l.id ? (
              <div className="stack-2">
                <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                <div className="row" style={{ gap: 6 }}>
                  <select style={{ width: 90 }} value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })}>
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                  <input className="grow" placeholder="Description" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm auto" onClick={() => saveEdit(l.id)} disabled={busy}>Save</button>
                  <button className="btn ghost sm auto" onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="row between">
                <div className="grow">
                  <h3 style={{ margin: 0 }}>{l.name} <span className="tag">{l.unit}</span></h3>
                  {l.description && <span className="ti-meta">{l.description}</span>}
                  <div className="ti-meta">{l.usage > 0 ? `used in ${l.usage} place${l.usage === 1 ? "" : "s"}` : "unused"}</div>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn ghost sm auto" onClick={() => startEdit(l)}>Edit</button>
                  <button className="btn ghost sm auto" onClick={() => toggleStatus(l)}>Archive</button>
                  <button className="btn ghost sm auto" onClick={() => remove(l)} aria-label="Delete">
                    <IconX size={16} strokeWidth={2.5} aria-hidden />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {archived.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Archived</h2>
          {archived.map((l) => (
            <div key={l.id} className="list-item">
              <div className="grow">
                <h3 style={{ margin: 0, color: "var(--text-muted)" }}>{l.name}</h3>
                <span className="ti-meta">{l.usage > 0 ? `used in ${l.usage} place${l.usage === 1 ? "" : "s"}` : "unused"}</span>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn ghost sm auto" onClick={() => toggleStatus(l)}>Reactivate</button>
                {l.usage === 0 && <button className="btn ghost sm auto" onClick={() => remove(l)}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
