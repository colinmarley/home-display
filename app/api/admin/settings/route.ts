import { isAdmin } from "@/lib/adminAuth";
import { getSettings, updateSettings } from "@/lib/settings";
import { syncNow } from "@/lib/sync/scheduler";
import { body, json } from "@/lib/http";
import type { Settings } from "@/lib/types";

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return json({ error: "unauthorized" }, 401);
  const before = getSettings();
  const after = updateSettings(await body<Settings>(req));
  // Re-sync the sources whose output depends on what changed.
  if (after.weatherSource !== before.weatherSource || after.tz !== before.tz) void syncNow("weather");
  if (after.tz !== before.tz) void syncNow("calendar");
  return json(after);
}
