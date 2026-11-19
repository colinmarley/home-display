import { deleteItem, updateItem } from "@/lib/store";
import { body, cleanText, idParam, json } from "@/lib/http";

export async function PATCH(req: Request, ctx: RouteContext<"/api/items/[id]">) {
  const id = idParam((await ctx.params).id);
  if (!id) return json({ error: "bad id" }, 400);
  const b = await body<{ text: string; done: boolean }>(req);
  updateItem(id, {
    text: cleanText(b.text) ?? undefined,
    done: typeof b.done === "boolean" ? b.done : undefined,
  });
  return json({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/items/[id]">) {
  const id = idParam((await ctx.params).id);
  if (!id) return json({ error: "bad id" }, 400);
  deleteItem(id);
  return json({ ok: true });
}
