import { fetchAndCache, isAssetId, readCached } from "@/lib/sync/photos";

export const dynamic = "force-dynamic";

// Serves album photos from the local disk cache, falling back to Immich.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!isAssetId(id)) return new Response("bad id", { status: 400 });

  let img = readCached(id);
  if (!img) {
    try {
      img = await fetchAndCache(id);
    } catch (e) {
      console.error(`[photo] ${id}: ${e instanceof Error ? e.message : e}`);
      return new Response("photo unavailable", { status: 502 });
    }
  }
  return new Response(new Uint8Array(img.data), {
    headers: { "Content-Type": img.type, "Cache-Control": "public, max-age=86400" },
  });
}
