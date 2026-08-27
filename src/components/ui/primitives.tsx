import Link from "next/link";
import { IconWorkout, type LucideIcon } from "./icons";

export function Card({
  children,
  variant = "surface",
  tight,
  className,
  style,
}: {
  children: React.ReactNode;
  variant?: "surface" | "surface-2";
  tight?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const base = variant === "surface-2" ? "card-2" : "card";
  return (
    <div className={[base, tight ? "tight" : "", className ?? ""].filter(Boolean).join(" ")} style={style}>
      {children}
    </div>
  );
}

export function StatNumber({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="stat">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </div>
  );
}

export function ListRow({
  title,
  sub,
  right,
  href,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <div className="grow">
        <h3 style={{ margin: 0 }}>{title}</h3>
        {sub != null && <span className="ti-meta">{sub}</span>}
      </div>
      {right}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="list-item">
        {inner}
      </Link>
    );
  }
  return <div className="list-item">{inner}</div>;
}

export function EmptyState({
  icon: Icon = IconWorkout,
  title,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="ico" aria-hidden>
        <Icon size={40} strokeWidth={1.75} />
      </div>
      <h3 style={{ color: "var(--text)", marginBottom: 6 }}>{title}</h3>
      {children}
    </div>
  );
}
