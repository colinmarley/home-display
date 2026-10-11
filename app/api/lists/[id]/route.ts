import { deleteList, updateList } from "@/lib/store";
import { body, cleanText, idParam, json } from "@/lib/http";

export async function PATCH(req: Request, ctx: RouteContext<"/api/lists/[id]">) {
  const id = idParam((await ctx.params).id);
  if (!id) return json({ error: "bad id" }, 400);
  const b = await body<{ name: string; emoji: string }>(req);
  updateList(id, {
    name: cleanText(b.name, 60) ?? undefined,
    emoji: typeof b.emoji === "string" ? b.emoji.slice(0, 8) : undefined,
  });
  return json({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/lists/[id]">) {
  const id = idParam((await ctx.params).id);
  if (!id) return json({ error: "bad id" }, 400);
  deleteList(id);
  return json({ ok: true });
}
