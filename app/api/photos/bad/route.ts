import { markBadPhoto } from "@/lib/badPhotos";
import { dropCached, isAssetId } from "@/lib/sync/photos";
import { body, json } from "@/lib/http";

// The kiosk reports a photo that failed to load: hide it for a while and drop
// its cached copy so the next sync fetches a fresh one.
export async function POST(req: Request) {
  const { id } = await body<{ id: string }>(req);
  if (!id || !isAssetId(id)) return json({ error: "bad id" }, 400);
  markBadPhoto(id);
  dropCached(id);
  return json({ ok: true });
}
