import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// The display is LAN-only; ADMIN_PIN just keeps the settings page from being
// changed by a stray tap or a curious guest. Unset = admin is open.

export const ADMIN_COOKIE = "hd_admin";

function token(pin: string): string {
  return createHash("sha256").update(`home-display:${pin}`).digest("hex");
}

export function adminPinConfigured(): boolean {
  return !!process.env.ADMIN_PIN?.trim();
}

export function checkPin(pin: string): string | null {
  const want = process.env.ADMIN_PIN?.trim();
  if (!want) return token("");
  const a = Buffer.from(token(pin));
  const b = Buffer.from(token(want));
  return timingSafeEqual(a, b) ? token(want) : null;
}

export async function isAdmin(): Promise<boolean> {
  const want = process.env.ADMIN_PIN?.trim();
  if (!want) return true;
  return (await cookies()).get(ADMIN_COOKIE)?.value === token(want);
}
