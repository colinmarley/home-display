import { addItem } from "@/lib/store";
import { body, cleanText, idParam, json } from "@/lib/http";

export async function POST(req: Request, ctx: RouteContext<"/api/lists/[id]/items">) {
  const listId = idParam((await ctx.params).id);
  const text = cleanText((await body<{ text: string }>(req)).text);
  if (!listId || !text) return json({ error: "list id and text required" }, 400);
  return json({ id: addItem(listId, text) }, 201);
}
