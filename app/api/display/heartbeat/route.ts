import { heartbeat } from "@/lib/display";
import { json } from "@/lib/http";

export async function POST() {
  heartbeat();
  return json({ ok: true });
}
