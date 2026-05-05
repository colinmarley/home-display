export interface ImmichAsset {
  id: string;
  originalFileName: string;
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
  return ((data.assets as unknown[]) ?? []).filter(
    (a: unknown) => (a as { type: string }).type === "IMAGE"
  ) as ImmichAsset[];
}
