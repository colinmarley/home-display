// Photos the kiosk failed to load. Hidden for an hour, then retried — the
// next photos sync re-caches them if Immich still has them.

const HIDE_MS = 60 * 60_000;
const g = globalThis as unknown as { __homeDisplayBadPhotos?: Map<string, number> };

function map() {
  g.__homeDisplayBadPhotos ??= new Map();
  return g.__homeDisplayBadPhotos;
}

export function markBadPhoto(id: string, now = Date.now()): void {
  map().set(id, now + HIDE_MS);
}

export function badPhotoIds(now = Date.now()): Set<string> {
  const out = new Set<string>();
  for (const [id, until] of map()) {
    if (until > now) out.add(id);
    else map().delete(id);
  }
  return out;
}
