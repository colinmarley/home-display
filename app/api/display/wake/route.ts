import { getSettings } from "@/lib/settings";
import { displayState, wake } from "@/lib/display";
import { json } from "@/lib/http";

export async function POST() {
  const s = getSettings();
  wake(s);
  return json(displayState(s));
}
