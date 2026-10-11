import { clearDone } from "@/lib/store";
import { idParam, json } from "@/lib/http";

export async function POST(_req: Request, ctx: RouteContext<"/api/lists/[id]/clear-done">) {
  const id = idParam((await ctx.params).id);
  if (!id) return json({ error: "bad id" }, 400);
  clearDone(id);
  return json({ ok: true });
}
