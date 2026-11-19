import { getSettings } from "@/lib/settings";
import { displayState } from "@/lib/display";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

// Polled by the Pi display agent. ?format=text returns
// "<mode> <brightness 0-100> <seconds since page heartbeat, -1 if none>".
export async function GET(req: Request) {
  const d = displayState(getSettings());
  if (new URL(req.url).searchParams.get("format") === "text") {
    const age = d.lastHeartbeat ? Math.round((Date.now() - d.lastHeartbeat) / 1000) : -1;
    return new Response(`${d.mode} ${d.brightness} ${age}\n`, {
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  }
  return json(d);
}
