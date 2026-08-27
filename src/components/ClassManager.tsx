"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createWeightClass, updateWeightClass, setWeightClassStatus, deleteWeightClass,
  createExperienceClass, updateExperienceClass, setExperienceClassStatus, deleteExperienceClass,
  moveClass,
} from "@/app/admin/class-actions";
import { IconX } from "@/components/ui/icons";

export interface WeightItem { id: string; name: string; gender: string | null; minKg: number | null; maxKg: number | null; isActive: boolean; usage: number; }
export interface ExpItem { id: string; name: string; isActive: boolean; usage: number; }

export function ClassManager({ weight, experience }: { weight: WeightItem[]; experience: ExpItem[] }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const [err, setErr] = useState<string | null>(null);

  // weight create
  const [w, setW] = useState({ name: "", gender: "", minKg: "", maxKg: "" });
  const [editW, setEditW] = useState<string | null>(null);
  const [we, setWe] = useState({ name: "", gender: "", minKg: "", maxKg: "" });
  // exp create
  const [e, setE] = useState("");
  const [editE, setEditE] = useState<string | null>(null);
  const [ee, setEe] = useState("");

  async function run<T extends { ok: boolean; error?: string; archived?: boolean }>(p: Promise<T>) {
    setErr(null);
    const r = await p;
    if (!r.ok && r.error) setErr(r.error);
    if (r.archived) setErr("In use — archived instead of deleted.");
    refresh();
    return r;
  }

  return (
    <>
      {err && <p className="error">{err}</p>}

      <h2>Weight classes</h2>
      <div className="card">
        <div className="stack-2">
          <input placeholder="Name, e.g. M ≤83 kg" value={w.name} onChange={(ev) => setW({ ...w, name: ev.target.value })} />
          <div className="row" style={{ gap: 6 }}>
            <select style={{ width: 110 }} value={w.gender} onChange={(ev) => setW({ ...w, gender: ev.target.value })}>
              <option value="">Any</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <input className="grow input-num" type="number" placeholder="min kg" value={w.minKg} onChange={(ev) => setW({ ...w, minKg: ev.target.value })} />
            <input className="grow input-num" type="number" placeholder="max kg" value={w.maxKg} onChange={(ev) => setW({ ...w, maxKg: ev.target.value })} />
          </div>
          <button className="btn auto" disabled={!w.name.trim()} onClick={async () => { await run(createWeightClass({ name: w.name, gender: w.gender, minKg: w.minKg || null, maxKg: w.maxKg || null })); setW({ name: "", gender: "", minKg: "", maxKg: "" }); }}>
            Add weight class
          </button>
        </div>
      </div>
      <div className="card">
        {weight.length === 0 && <p className="muted small">None yet.</p>}
        {weight.map((c, i) => (
          <div key={c.id} style={{ borderBottom: "1px solid var(--border)", padding: "10px 0" }}>
            {editW === c.id ? (
              <div className="stack-2">
                <input value={we.name} onChange={(ev) => setWe({ ...we, name: ev.target.value })} />
                <div className="row" style={{ gap: 6 }}>
                  <select style={{ width: 110 }} value={we.gender} onChange={(ev) => setWe({ ...we, gender: ev.target.value })}>
                    <option value="">Any</option><option value="male">Male</option><option value="female">Female</option>
                  </select>
                  <input className="grow input-num" type="number" placeholder="min" value={we.minKg} onChange={(ev) => setWe({ ...we, minKg: ev.target.value })} />
                  <input className="grow input-num" type="number" placeholder="max" value={we.maxKg} onChange={(ev) => setWe({ ...we, maxKg: ev.target.value })} />
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm auto" onClick={async () => { await run(updateWeightClass(c.id, { name: we.name, gender: we.gender, minKg: we.minKg || null, maxKg: we.maxKg || null })); setEditW(null); }}>Save</button>
                  <button className="btn ghost sm auto" onClick={() => setEditW(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="row between">
                <div className="grow">
                  <h3 style={{ margin: 0, color: c.isActive ? "var(--text)" : "var(--text-muted)" }}>{c.name}</h3>
                  <span className="ti-meta">
                    {[c.gender ?? "any", c.minKg != null || c.maxKg != null ? `${c.minKg ?? 0}–${c.maxKg ?? "∞"} kg` : null, c.usage > 0 ? `${c.usage} in use` : "unused", c.isActive ? null : "archived"].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn ghost sm auto" disabled={i === 0} onClick={() => run(moveClass("weight", c.id, -1))}>↑</button>
                  <button className="btn ghost sm auto" disabled={i === weight.length - 1} onClick={() => run(moveClass("weight", c.id, 1))}>↓</button>
                  <button className="btn ghost sm auto" onClick={() => { setEditW(c.id); setWe({ name: c.name, gender: c.gender ?? "", minKg: c.minKg?.toString() ?? "", maxKg: c.maxKg?.toString() ?? "" }); }}>Edit</button>
                  <button className="btn ghost sm auto" onClick={() => run(setWeightClassStatus(c.id, !c.isActive))}>{c.isActive ? "Archive" : "Restore"}</button>
                  <button className="btn ghost sm auto" onClick={() => run(deleteWeightClass(c.id))}><IconX size={16} strokeWidth={2.5} aria-hidden /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <h2>Experience classes</h2>
      <div className="card">
        <div className="row" style={{ gap: 6 }}>
          <input className="grow" placeholder="Name, e.g. Advanced" value={e} onChange={(ev) => setE(ev.target.value)} />
          <button className="btn sm auto" disabled={!e.trim()} onClick={async () => { await run(createExperienceClass({ name: e })); setE(""); }}>Add</button>
        </div>
      </div>
      <div className="card">
        {experience.length === 0 && <p className="muted small">None yet.</p>}
        {experience.map((c, i) => (
          <div key={c.id} className="row between" style={{ borderBottom: "1px solid var(--border)", padding: "10px 0" }}>
            {editE === c.id ? (
              <>
                <input className="grow" value={ee} onChange={(ev) => setEe(ev.target.value)} />
                <button className="btn sm auto" onClick={async () => { await run(updateExperienceClass(c.id, { name: ee })); setEditE(null); }}>Save</button>
                <button className="btn ghost sm auto" onClick={() => setEditE(null)}>Cancel</button>
              </>
            ) : (
              <>
                <div className="grow">
                  <h3 style={{ margin: 0, color: c.isActive ? "var(--text)" : "var(--text-muted)" }}>{c.name}</h3>
                  <span className="ti-meta">{c.usage > 0 ? `${c.usage} in use` : "unused"}{c.isActive ? "" : " · archived"}</span>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn ghost sm auto" disabled={i === 0} onClick={() => run(moveClass("experience", c.id, -1))}>↑</button>
                  <button className="btn ghost sm auto" disabled={i === experience.length - 1} onClick={() => run(moveClass("experience", c.id, 1))}>↓</button>
                  <button className="btn ghost sm auto" onClick={() => { setEditE(c.id); setEe(c.name); }}>Edit</button>
                  <button className="btn ghost sm auto" onClick={() => run(setExperienceClassStatus(c.id, !c.isActive))}>{c.isActive ? "Archive" : "Restore"}</button>
                  <button className="btn ghost sm auto" onClick={() => run(deleteExperienceClass(c.id))}><IconX size={16} strokeWidth={2.5} aria-hidden /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
