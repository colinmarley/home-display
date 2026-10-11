import { createList, getLists } from "@/lib/store";
import { body, cleanText, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(getLists());
}

export async function POST(req: Request) {
  const b = await body<{ name: string; emoji: string }>(req);
  const name = cleanText(b.name, 60);
  if (!name) return json({ error: "name required" }, 400);
  return json({ id: createList(name, cleanText(b.emoji, 8) ?? "") }, 201);
}
