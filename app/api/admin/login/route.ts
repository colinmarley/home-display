import { NextResponse } from "next/server";
import { ADMIN_COOKIE, checkPin } from "@/lib/adminAuth";
import { body } from "@/lib/http";

export async function POST(req: Request) {
  const { pin } = await body<{ pin: string }>(req);
  const tok = checkPin(String(pin ?? ""));
  if (!tok) return NextResponse.json({ error: "wrong PIN" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, tok, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
  return res;
}
