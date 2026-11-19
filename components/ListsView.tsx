"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { api } from "@/lib/client";
import type { AppState } from "@/lib/types";

interface Props {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  refresh: () => Promise<void>;
}

export default function ListsView({ state, setState, refresh }: Props) {
  const lists = state.lists;
  const [activeId, setActiveId] = useState<number | null>(lists[0]?.id ?? null);
  const active = lists.find((l) => l.id === activeId) ?? lists[0];

  // Optimistic: flip locally, then persist and re-sync.
  const toggle = (itemId: number, done: boolean) => {
    setState((s) => ({
      ...s,
      lists: s.lists.map((l) => ({ ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, done } : i)) })),
    }));
    void api(`/api/items/${itemId}`, "PATCH", { done }).finally(refresh);
  };
  const clearDone = (listId: number) => {
    setState((s) => ({
      ...s,
      lists: s.lists.map((l) => (l.id === listId ? { ...l, items: l.items.filter((i) => !i.done) } : l)),
    }));
    void api(`/api/lists/${listId}/clear-done`, "POST").finally(refresh);
  };

  if (!active) {
    return <div style={{ padding: 24, color: "var(--text-dim)" }}>No lists yet — create one from the admin page on your phone.</div>;
  }
  const open = active.items.filter((i) => !i.done);
  const done = active.items.filter((i) => i.done);

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div className="scroll-y" style={{ width: 190, borderRight: "1px solid var(--border)", padding: 8, display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        {lists.map((l) => {
          const left = l.items.filter((i) => !i.done).length;
          return (
            <button
              key={l.id}
              onClick={() => setActiveId(l.id)}
              style={{
                textAlign: "left",
                padding: "12px 12px",
                borderRadius: 8,
                background: l.id === active.id ? "var(--accent-soft)" : "transparent",
                border: `1px solid ${l.id === active.id ? "var(--accent)" : "var(--border)"}`,
                display: "flex",
                justifyContent: "space-between",
                minHeight: 48,
              }}
            >
              <span>{l.emoji} {l.name}</span>
              <span className="num" style={{ color: "var(--text-dim)" }}>{left || ""}</span>
            </button>
          );
        })}
      </div>
      <div className="scroll-y" style={{ flex: 1, padding: "8px 14px" }}>
        {open.length === 0 && <div style={{ color: "var(--text-dim)", padding: "14px 0" }}>All done 🎉</div>}
        {[...open, ...done].map((i) => (
          <button
            key={i.id}
            onClick={() => toggle(i.id, !i.done)}
            style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", minHeight: 52, borderBottom: "1px solid var(--border)" }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                border: `2px solid ${i.done ? "var(--ok)" : "var(--text-dim)"}`,
                background: i.done ? "var(--ok)" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#fff",
                fontWeight: 700,
              }}
            >
              {i.done ? "✓" : ""}
            </span>
            <span style={{ fontSize: "1.05rem", textDecoration: i.done ? "line-through" : "none", color: i.done ? "var(--text-faint)" : "var(--text)" }}>
              {i.text}
            </span>
          </button>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
          <span className="label">Add items from your phone: /admin</span>
          {done.length > 0 && (
            <button className="chip" onClick={() => clearDone(active.id)}>
              Clear {done.length} done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
