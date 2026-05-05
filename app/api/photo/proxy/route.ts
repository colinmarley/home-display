export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  const baseUrl = process.env.IMMICH_BASE_URL;
  const apiKey = process.env.IMMICH_API_KEY;
  if (!baseUrl || !apiKey)
    return new Response("Immich not configured", { status: 503 });

  const upstream = await fetch(
    `${baseUrl}/api/assets/${id}/thumbnail?size=preview`,
    { headers: { "x-api-key": apiKey } }
  );

  if (!upstream.ok) return new Response("Not found", { status: 404 });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
