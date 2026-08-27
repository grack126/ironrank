"use client";
import { Children, useState } from "react";

/**
 * Renders at most `initial` children, with a Show all / Show less toggle when
 * there are more. Keeps long profile lists from becoming an endless scroll.
 * State is local and intentionally not persisted.
 */
export function ExpandableList({
  children,
  initial = 10,
}: {
  children: React.ReactNode;
  initial?: number;
}) {
  const items = Children.toArray(children);
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > initial;

  return (
    <>
      {expanded ? items : items.slice(0, initial)}
      {hasMore && (
        <button
          type="button"
          className="btn secondary sm auto"
          style={{ marginTop: "var(--s-3)" }}
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : `Show all (${items.length})`}
        </button>
      )}
    </>
  );
}
