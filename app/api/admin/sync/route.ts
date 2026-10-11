import { isAdmin } from "@/lib/adminAuth";
import { syncNow } from "@/lib/sync/scheduler";
import { buildState } from "@/lib/state";
import { body, json } from "@/lib/http";

export async function POST(req: Request) {
  if (!(await isAdmin())) return json({ error: "unauthorized" }, 401);
  const { source } = await body<{ source: string }>(req);
  try {
    await syncNow(String(source));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
  return json(buildState().sync);
}
