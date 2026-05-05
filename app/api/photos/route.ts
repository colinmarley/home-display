import { getAlbumAssets } from "@/lib/immich";

export async function GET() {
  const assets = await getAlbumAssets();
  return Response.json(assets);
}
