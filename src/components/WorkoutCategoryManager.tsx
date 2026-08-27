"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createWorkoutCategory, updateWorkoutCategory, setWorkoutCategoryStatus, deleteWorkoutCategory, moveWorkoutCategory,
} from "@/app/admin/workout-category-actions";
import { IconX } from "@/components/ui/icons";

export interface CategoryItem { id: string; name: string; description: string | null; imageRef: string | null; isActive: boolean; usage: number; }

export function WorkoutCategoryManager({ categories }: { categories: CategoryItem[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [c, setC] = useState({ name: "", imageRef: "", description: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [e, setE] = useState({ name: "", imageRef: "", description: "" });

  async function run<T extends { ok: boolean; error?: string; archived?: boolean }>(promise: Promise<T>) {
    setErr(null);
    const r = await promise;
    if (!r.ok && r.error) setErr(r.error);
    if (r.archived) setErr("In use — archived instead of deleted.");
    router.refresh();
    return r;
  }

  return (
    <>
      {err && <p className="error">{err}</p>}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Add a category</h2>
        <div className="stack-2">
          <div className="row" style={{ gap: 6 }}>
            <input style={{ width: 64 }} placeholder="🏋️" value={c.imageRef} onChange={(ev) => setC({ ...c, imageRef: ev.target.value })} />
            <input className="grow" placeholder="Name, e.g. Push / Pull / Legs" value={c.name} onChange={(ev) => setC({ ...c, name: ev.target.value })} />
          </div>
          <input placeholder="Description (optional)" value={c.description} onChange={(ev) => setC({ ...c, description: ev.target.value })} />
          <button className="btn auto" disabled={!c.name.trim()} onClick={async () => { await run(createWorkoutCategory(c)); setC({ name: "", imageRef: "", description: "" }); }}>
            Add category
          </button>
        </div>
      </div>

      <div className="card">
        {categories.length === 0 && <p className="muted small">No categories yet.</p>}
        {categories.map((cat, i) => (
          <div key={cat.id} style={{ borderBottom: "1px solid var(--border)", padding: "10px 0" }}>
            {editId === cat.id ? (
              <div className="stack-2">
                <div className="row" style={{ gap: 6 }}>
                  <input style={{ width: 64 }} value={e.imageRef} onChange={(ev) => setE({ ...e, imageRef: ev.target.value })} />
                  <input className="grow" value={e.name} onChange={(ev) => setE({ ...e, name: ev.target.value })} />
                </div>
                <input value={e.description} placeholder="Description" onChange={(ev) => setE({ ...e, description: ev.target.value })} />
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm auto" onClick={async () => { await run(updateWorkoutCategory(cat.id, e)); setEditId(null); }}>Save</button>
                  <button className="btn ghost sm auto" onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="row between">
                <div className="grow">
                  <h3 style={{ margin: 0, color: cat.isActive ? "var(--text)" : "var(--text-muted)" }}>
                    {cat.imageRef ? `${cat.imageRef} ` : ""}{cat.name}
                  </h3>
                  <span className="ti-meta">
                    {[cat.description, cat.usage > 0 ? `${cat.usage} workout${cat.usage === 1 ? "" : "s"}` : "empty", cat.isActive ? null : "archived"].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn ghost sm auto" disabled={i === 0} onClick={() => run(moveWorkoutCategory(cat.id, -1))}>↑</button>
                  <button className="btn ghost sm auto" disabled={i === categories.length - 1} onClick={() => run(moveWorkoutCategory(cat.id, 1))}>↓</button>
                  <button className="btn ghost sm auto" onClick={() => { setEditId(cat.id); setE({ name: cat.name, imageRef: cat.imageRef ?? "", description: cat.description ?? "" }); }}>Edit</button>
                  <button className="btn ghost sm auto" onClick={() => run(setWorkoutCategoryStatus(cat.id, !cat.isActive))}>{cat.isActive ? "Archive" : "Restore"}</button>
                  <button className="btn ghost sm auto" aria-label="Delete" onClick={() => run(deleteWorkoutCategory(cat.id))}>
                    <IconX size={16} strokeWidth={2.5} aria-hidden />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
