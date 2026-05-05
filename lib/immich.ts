export interface ImmichAsset {
  id: string;
  originalFileName: string;
}

interface RawImmichAsset {
  id?: string;
  assetId?: string;
  type?: string;
  originalFileName?: string;
}

export async function getAlbumAssets(): Promise<ImmichAsset[]> {
  const baseUrl = process.env.IMMICH_BASE_URL;
  const apiKey = process.env.IMMICH_API_KEY;
  const albumId = process.env.IMMICH_ALBUM_ID;
  if (!baseUrl || !apiKey || !albumId) return [];

  const res = await fetch(`${baseUrl}/api/albums/${albumId}`, {
    headers: { "x-api-key": apiKey },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];

  const data = await res.json();
  const assets = ((data.assets as RawImmichAsset[]) ?? []).filter(
    (a) => a.type === "IMAGE"
  );

  return assets
    .map((a) => ({
      id: a.id ?? a.assetId ?? "",
      originalFileName: a.originalFileName ?? "",
    }))
    .filter((a) => a.id.length > 0);
}
