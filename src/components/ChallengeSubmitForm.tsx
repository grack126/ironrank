"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { submitChallengeAttempt } from "@/app/challenge-actions";
import { toKg, fromKg, type Unit } from "@/lib/shared/units";
import type { ChallengeType } from "@/lib/shared/challenge";
import { haptic } from "@/lib/haptics";
import { IconStar } from "@/components/ui/icons";

interface Pending {
  rawValue: number;
  bodyweightKg: number | null;
  videoUrl: string | null;
}

export function ChallengeSubmitForm({
  challengeId,
  challengeType,
  weightBased,
  unitLabel,
  userUnit,
  defaultBodyweightKg,
  open,
}: {
  challengeId: string;
  challengeType: ChallengeType;
  weightBased: boolean;
  unitLabel: string;
  userUnit: Unit;
  defaultBodyweightKg: number | null;
  open: boolean;
}) {
  const router = useRouter();
  const storageKey = `ironrank-pending-sub-${challengeId}`;
  const [value, setValue] = useState("");
  const [bodyweight, setBodyweight] = useState(
    defaultBodyweightKg != null ? String(Math.round(fromKg(defaultBodyweightKg, userUnit) * 10) / 10) : ""
  );
  const [videoUrl, setVideoUrl] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "offline" | "pr"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(p: Pending, fromOffline: boolean) {
    return submitChallengeAttempt(challengeId, { ...p, syncedFromOffline: fromOffline });
  }

  // Flush any attempt saved while offline.
  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    (async () => {
      try {
        const p: Pending = JSON.parse(raw);
        const res = await send(p, true);
        if (res.ok) {
          localStorage.removeItem(storageKey);
          setMsg({ kind: "ok", text: "Synced an attempt you logged offline." });
          router.refresh();
        }
      } catch {
        /* still offline */
      }
    })();
  }, [storageKey, router]);

  const valueLabel = weightBased
    ? `Result (${userUnit})`
    : challengeType === "for_time"
      ? "Result (seconds)"
      : `Result (${unitLabel})`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return setMsg({ kind: "err", text: "Enter a result greater than 0." });

    const bwNum = parseFloat(bodyweight);
    const payload: Pending = {
      rawValue: weightBased ? toKg(num, userUnit) : num,
      bodyweightKg: !isNaN(bwNum) && bwNum > 0 ? toKg(bwNum, userUnit) : null,
      videoUrl: videoUrl.trim() || null,
    };

    setBusy(true);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      localStorage.setItem(storageKey, JSON.stringify(payload));
      setBusy(false);
      haptic("warning");
      return setMsg({ kind: "offline", text: "You're offline — saved on this device and will sync automatically." });
    }
    try {
      const res = await send(payload, false);
      setBusy(false);
      if (!res.ok) return setMsg({ kind: "err", text: res.error });
      haptic(res.isPR ? "reveal" : "success");
      setValue("");
      setVideoUrl("");
      const base = res.status === "pending" ? "Logged — pending verification of your video." : "Logged to the unverified board. Add a video to get verified.";
      setMsg({
        kind: res.isPR ? "pr" : "ok",
        text: res.isPR ? `New personal best! ${base}` : base,
      });
      router.refresh();
    } catch {
      localStorage.setItem(storageKey, JSON.stringify(payload));
      setBusy(false);
      setMsg({ kind: "offline", text: "Couldn't reach the server — saved on this device and will sync automatically." });
    }
  }

  if (!open) {
    return <p className="muted small">This challenge is closed to new entries.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <div className="grid2">
        <div>
          <label>{valueLabel}</label>
          <input className="input-num" type="number" step="0.01" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} required />
        </div>
        <div>
          <label>Bodyweight ({userUnit})</label>
          <input className="input-num" type="number" step="0.1" inputMode="decimal" value={bodyweight} onChange={(e) => setBodyweight(e.target.value)} />
        </div>
      </div>
      <div>
        <label>Video proof URL (needed for verification)</label>
        <input type="url" placeholder="https://… (your social post)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
      </div>
      {msg && (
        msg.kind === "pr"
          ? <div className="banner animate-pop row" style={{ borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 600, gap: 8 }}>
              <IconStar size={16} strokeWidth={2.5} aria-hidden />
              <span>{msg.text}</span>
            </div>
          : <p className={msg.kind === "ok" ? "ok" : msg.kind === "offline" ? "banner" : "error"}>{msg.text}</p>
      )}
      <button className="btn round" type="submit" disabled={busy}>
        {busy ? "Logging…" : "Log attempt"}
      </button>
      <p className="tiny faint">Bodyweight is snapshotted with your attempt so relative scores stay honest. Video links can rot — keep yours public.</p>
    </form>
  );
}
