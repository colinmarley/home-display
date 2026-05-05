export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const debug = searchParams.get("debug") === "1";
  if (!id) return new Response("Missing id", { status: 400 });

  const baseUrl = process.env.IMMICH_BASE_URL;
  const apiKey = process.env.IMMICH_API_KEY;
  if (!baseUrl || !apiKey)
    return new Response("Immich not configured", { status: 503 });

  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  const candidates = [
    `${cleanBaseUrl}/api/assets/${id}/thumbnail?size=preview`,
    `${cleanBaseUrl}/api/assets/${id}/thumbnail?size=thumbnail`,
    `${cleanBaseUrl}/api/assets/${id}/thumbnail`,
    `${cleanBaseUrl}/api/assets/${id}/original`,
  ];

  let upstream: Response | null = null;
  let lastStatus = 502;
  const attempts: Array<{ url: string; status: number }> = [];

  for (const url of candidates) {
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    attempts.push({ url, status: res.status });
    if (res.ok) {
      upstream = res;
      break;
    }
    lastStatus = res.status;
  }

  if (!upstream) {
    if (debug) {
      return Response.json(
        {
          error: "Immich asset fetch failed",
          id,
          baseUrl: cleanBaseUrl,
          attempts,
        },
        { status: 404 }
      );
    }

    const status = lastStatus === 401 || lastStatus === 403 ? 502 : 404;
    return new Response("Immich asset fetch failed", { status });
  }

  if (debug) {
    return Response.json({
      ok: true,
      id,
      baseUrl: cleanBaseUrl,
      attempts,
      contentType: upstream.headers.get("Content-Type") ?? null,
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
