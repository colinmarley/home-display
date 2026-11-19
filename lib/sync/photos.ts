import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../store";
import type { PhotoAsset, PhotosPayload } from "../types";

// Immich album → asset list, plus an on-disk cache of preview-size images so
// the slideshow keeps working while Immich (or the NAS behind it) is down.

const TIMEOUT_MS = 30_000;
const CACHE_DIR = path.join(/*turbopackIgnore: true*/ DATA_DIR, "photo-cache");
const CACHE_MAX_BYTES = Number(process.env.PHOTO_CACHE_MB ?? 1024) * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAssetId(id: string): boolean {
  return UUID_RE.test(id);
}

function immich(): { base: string; key: string; album: string } {
  const base = process.env.IMMICH_BASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.IMMICH_API_KEY?.trim();
  const album = process.env.IMMICH_ALBUM_ID?.trim();
  if (!base || !key || !album) throw new Error("IMMICH_BASE_URL / IMMICH_API_KEY / IMMICH_ALBUM_ID not set");
  return { base, key, album };
}

function describeStatus(status: number): string {
  if (status === 401) return "Immich rejected the API key (401) — regenerate it in Immich account settings";
  if (status === 403) return "Immich API key lacks permission (403) — it needs album.read + asset.view";
  if (status === 404) return "Immich album not found (404) — check IMMICH_ALBUM_ID";
  return `Immich ${status}`;
}

interface RawAsset {
  id: string;
  type?: string;
  isTrashed?: boolean;
  isArchived?: boolean;
  visibility?: string;
  localDateTime?: string;
  fileCreatedAt?: string;
}

async function immichJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const { key } = immich();
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "x-api-key": key, Accept: "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(describeStatus(res.status));
  return (await res.json()) as T;
}

/** Album assets via the album endpoint; falls back to paged metadata search if the album omits them. */
async function fetchAlbumAssets(): Promise<{ name: string; assets: RawAsset[] }> {
  const { base, album } = immich();
  const a = await immichJson<{ albumName: string; assetCount: number; assets?: RawAsset[] }>(
    `${base}/api/albums/${album}`
  );
  if (a.assets && (a.assets.length > 0 || a.assetCount === 0)) return { name: a.albumName, assets: a.assets };

  const assets: RawAsset[] = [];
  for (let page = 1; page && page < 50; ) {
    const r = await immichJson<{ assets: { items: RawAsset[]; nextPage: string | null } }>(`${base}/api/search/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumIds: [album], type: "IMAGE", size: 250, page }),
    });
    assets.push(...r.assets.items);
    page = r.assets.nextPage ? Number(r.assets.nextPage) : 0;
  }
  return { name: a.albumName, assets };
}

// ── Disk cache ───────────────────────────────────────────────────────────────

function cachePath(id: string, ext: string) {
  return path.join(CACHE_DIR, `${id}.${ext}`);
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" };
const TYPE: Record<string, string> = { jpg: "image/jpeg", webp: "image/webp", png: "image/png" };

export function readCached(id: string): { data: Buffer; type: string } | null {
  if (!isAssetId(id)) return null;
  for (const ext of Object.keys(TYPE)) {
    const p = cachePath(id, ext);
    try {
      const data = fs.readFileSync(p);
      const now = new Date();
      fs.utimesSync(p, now, now); // LRU touch
      return { data, type: TYPE[ext] };
    } catch {}
  }
  return null;
}

export function dropCached(id: string): void {
  if (!isAssetId(id)) return;
  for (const ext of Object.keys(TYPE)) fs.rmSync(cachePath(id, ext), { force: true });
}

/** Fetch a preview from Immich, store it, return it. */
export async function fetchAndCache(id: string): Promise<{ data: Buffer; type: string }> {
  if (!isAssetId(id)) throw new Error("bad asset id");
  const { base, key } = immich();
  const res = await fetch(`${base}/api/assets/${id}/thumbnail?size=preview`, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "x-api-key": key },
  });
  if (!res.ok) throw new Error(describeStatus(res.status));
  const type = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0];
  const data = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath(id, EXT[type] ?? "jpg"), data);
  return { data, type: TYPE[EXT[type] ?? "jpg"] };
}

function cachedIds(): Map<string, { file: string; size: number; mtime: number }> {
  const out = new Map<string, { file: string; size: number; mtime: number }>();
  let names: string[] = [];
  try {
    names = fs.readdirSync(CACHE_DIR);
  } catch {
    return out;
  }
  for (const name of names) {
    const file = path.join(CACHE_DIR, name);
    const st = fs.statSync(file);
    out.set(name.replace(/\.[a-z]+$/, ""), { file, size: st.size, mtime: st.mtimeMs });
  }
  return out;
}

/** Remove images no longer in the album, then trim least-recently-used to the size cap. */
function pruneCache(keep: Set<string>): number {
  const entries = cachedIds();
  for (const [id, e] of entries) {
    if (!keep.has(id)) {
      fs.rmSync(e.file, { force: true });
      entries.delete(id);
    }
  }
  let total = [...entries.values()].reduce((s, e) => s + e.size, 0);
  for (const [id, e] of [...entries].sort((a, b) => a[1].mtime - b[1].mtime)) {
    if (total <= CACHE_MAX_BYTES) break;
    fs.rmSync(e.file, { force: true });
    total -= e.size;
    entries.delete(id);
  }
  return entries.size;
}

export async function syncPhotos(): Promise<{ payload: PhotosPayload; warning: string | null }> {
  const { name, assets: raw } = await fetchAlbumAssets();
  const assets: PhotoAsset[] = raw
    .filter((a) => (a.type ?? "IMAGE") === "IMAGE" && !a.isTrashed && a.visibility !== "hidden")
    .map((a) => ({ id: a.id, takenAt: a.localDateTime ?? a.fileCreatedAt }))
    .filter((a) => isAssetId(a.id));

  // Warm the cache so every album photo is on local disk.
  const have = cachedIds();
  let failed = 0;
  for (const a of assets) {
    if (have.has(a.id)) continue;
    try {
      await fetchAndCache(a.id);
    } catch {
      failed++;
    }
  }
  const cached = pruneCache(new Set(assets.map((a) => a.id)));
  return {
    payload: { albumName: name, assets, cached },
    warning: failed ? `${failed} photo(s) could not be cached` : null,
  };
}
