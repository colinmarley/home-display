export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSync } = await import("./lib/sync/scheduler");
    await startSync();
  }
}
