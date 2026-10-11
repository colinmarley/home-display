import AppShell from "@/components/AppShell";
import { buildState } from "@/lib/state";

// Always render from the local store: it is fast, and it's the only place
// the kiosk ever reads from — upstream services are the sync layer's problem.
export const dynamic = "force-dynamic";

export default function Home() {
  return <AppShell initial={buildState()} />;
}
