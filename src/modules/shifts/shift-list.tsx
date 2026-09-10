"use client";
import { Children, useState, type ReactNode } from "react";

export function ShiftList({ states, children }: { states: string[]; children: ReactNode }) {
  const [filter, setFilter] = useState(
    states.some((s) => !["closed", "cancelled"].includes(s)) ? "work" : "history",
  );
  const matches = (state: string, group: string) =>
    group === "requests"
      ? state.startsWith("awaiting")
      : group === "active"
        ? ["open", "pending_close"].includes(state)
        : group === "history"
          ? ["closed", "cancelled"].includes(state)
          : !["closed", "cancelled"].includes(state);
  const effectiveFilter =
    ["work", "active"].includes(filter) &&
    states.length > 0 &&
    states.every((s) => ["closed", "cancelled"].includes(s))
      ? "history"
      : filter;
  const visible = Children.toArray(children).filter((_, i) => matches(states[i], effectiveFilter));
  return (
    <div>
      <div className="shift-filters" role="group" aria-label="Filtrează cererile și turele">
        {[
          ["work", "În lucru"],
          ["requests", "Cereri"],
          ["active", "Ture active"],
          ["history", "Istoric"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={effectiveFilter === key}
            onClick={() => setFilter(key)}
          >
            {label} <span>{states.filter((state) => matches(state, key)).length}</span>
          </button>
        ))}
      </div>
      {visible.length ? (
        visible
      ) : (
        <p className="identity-note">Nu există ture în această categorie.</p>
      )}
    </div>
  );
}
