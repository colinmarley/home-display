import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { ListItem, ShoppingList } from "./types";

// SQLite (node:sqlite, no native build) on the ./data volume. Holds the last
// known-good snapshot of every synced source, settings, and shared lists.

export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "./data");

const g = globalThis as unknown as { __homeDisplayDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (g.__homeDisplayDb) return g.__homeDisplayDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const conn = new DatabaseSync(path.join(DATA_DIR, "home-display.db"));
  conn.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS snapshots (
      source TEXT PRIMARY KEY,
      payload TEXT,
      synced_at INTEGER,
      last_attempt_at INTEGER,
      last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);
  conn.exec("PRAGMA foreign_keys = ON;");
  const count = conn.prepare("SELECT COUNT(*) AS n FROM lists").get() as { n: number };
  if (count.n === 0) {
    const ins = conn.prepare("INSERT INTO lists (name, emoji, position) VALUES (?, ?, ?)");
    ins.run("Groceries", "🛒", 0);
    ins.run("Chores", "🧹", 1);
    ins.run("To-do", "✅", 2);
  }
  g.__homeDisplayDb = conn;
  return conn;
}

// ── Snapshots ────────────────────────────────────────────────────────────────

export interface Snapshot<T = unknown> {
  source: string;
  payload: T | null;
  syncedAt: number | null;
  lastAttemptAt: number | null;
  lastError: string | null;
}

interface SnapshotRow {
  source: string;
  payload: string | null;
  synced_at: number | null;
  last_attempt_at: number | null;
  last_error: string | null;
}

function rowToSnapshot<T>(r: SnapshotRow): Snapshot<T> {
  return {
    source: r.source,
    payload: r.payload ? (JSON.parse(r.payload) as T) : null,
    syncedAt: r.synced_at,
    lastAttemptAt: r.last_attempt_at,
    lastError: r.last_error,
  };
}

export function getSnapshot<T>(source: string): Snapshot<T> | null {
  const r = db().prepare("SELECT * FROM snapshots WHERE source = ?").get(source) as
    | SnapshotRow
    | undefined;
  return r ? rowToSnapshot<T>(r) : null;
}

export function allSnapshots(): Snapshot[] {
  const rows = db().prepare("SELECT * FROM snapshots ORDER BY source").all() as unknown as SnapshotRow[];
  return rows.map((r) => rowToSnapshot(r));
}

/** Store a successful sync. `warning` records a partial failure without discarding data. */
export function saveSnapshot(source: string, payload: unknown, warning: string | null = null): void {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO snapshots (source, payload, synced_at, last_attempt_at, last_error)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(source) DO UPDATE SET payload = excluded.payload, synced_at = excluded.synced_at,
         last_attempt_at = excluded.last_attempt_at, last_error = excluded.last_error`
    )
    .run(source, JSON.stringify(payload), now, now, warning);
}

/** Record a failed sync. The previous payload is kept untouched. */
export function recordSyncError(source: string, error: string): void {
  db()
    .prepare(
      `INSERT INTO snapshots (source, payload, synced_at, last_attempt_at, last_error)
       VALUES (?, NULL, NULL, ?, ?)
       ON CONFLICT(source) DO UPDATE SET last_attempt_at = excluded.last_attempt_at,
         last_error = excluded.last_error`
    )
    .run(source, Date.now(), error);
}

// ── Key/value (settings, misc state) ────────────────────────────────────────

export function kvGet<T>(key: string): T | null {
  const r = db().prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
  return r ? (JSON.parse(r.value) as T) : null;
}

export function kvSet(key: string, value: unknown): void {
  db()
    .prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, JSON.stringify(value));
}

// ── Lists ────────────────────────────────────────────────────────────────────

interface ItemRow {
  id: number;
  list_id: number;
  text: string;
  done: number;
  position: number;
}

export function getLists(): ShoppingList[] {
  const conn = db();
  const lists = conn.prepare("SELECT id, name, emoji FROM lists ORDER BY position, id").all() as unknown as {
    id: number;
    name: string;
    emoji: string;
  }[];
  const items = conn
    .prepare("SELECT id, list_id, text, done, position FROM list_items ORDER BY done, position, id")
    .all() as unknown as ItemRow[];
  return lists.map((l) => ({
    ...l,
    items: items
      .filter((i) => i.list_id === l.id)
      .map<ListItem>((i) => ({ id: i.id, listId: i.list_id, text: i.text, done: !!i.done, position: i.position })),
  }));
}

export function createList(name: string, emoji = ""): number {
  const conn = db();
  const max = conn.prepare("SELECT COALESCE(MAX(position), -1) AS p FROM lists").get() as { p: number };
  const r = conn.prepare("INSERT INTO lists (name, emoji, position) VALUES (?, ?, ?)").run(name, emoji, max.p + 1);
  return Number(r.lastInsertRowid);
}

export function updateList(id: number, fields: { name?: string; emoji?: string }): void {
  const cur = db().prepare("SELECT name, emoji FROM lists WHERE id = ?").get(id) as
    | { name: string; emoji: string }
    | undefined;
  if (!cur) return;
  db()
    .prepare("UPDATE lists SET name = ?, emoji = ? WHERE id = ?")
    .run(fields.name ?? cur.name, fields.emoji ?? cur.emoji, id);
}

export function deleteList(id: number): void {
  db().prepare("DELETE FROM lists WHERE id = ?").run(id);
}

export function addItem(listId: number, text: string): number {
  const conn = db();
  const max = conn
    .prepare("SELECT COALESCE(MAX(position), -1) AS p FROM list_items WHERE list_id = ?")
    .get(listId) as { p: number };
  const r = conn
    .prepare("INSERT INTO list_items (list_id, text, done, position, created_at) VALUES (?, ?, 0, ?, ?)")
    .run(listId, text, max.p + 1, Date.now());
  return Number(r.lastInsertRowid);
}

export function updateItem(id: number, fields: { text?: string; done?: boolean }): void {
  const cur = db().prepare("SELECT text, done FROM list_items WHERE id = ?").get(id) as
    | { text: string; done: number }
    | undefined;
  if (!cur) return;
  const done = fields.done === undefined ? cur.done : fields.done ? 1 : 0;
  db()
    .prepare("UPDATE list_items SET text = ?, done = ? WHERE id = ?")
    .run(fields.text ?? cur.text, done, id);
}

export function deleteItem(id: number): void {
  db().prepare("DELETE FROM list_items WHERE id = ?").run(id);
}

export function clearDone(listId: number): void {
  db().prepare("DELETE FROM list_items WHERE list_id = ? AND done = 1").run(listId);
}
