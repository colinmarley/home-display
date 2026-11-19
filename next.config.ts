import path from "node:path";
import type { NextConfig } from "next";

// Pin the project root: a stray lockfile in a parent directory otherwise makes
// Next pick the wrong workspace root (and nest the standalone output).
const root = path.resolve(".");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: root,
  turbopack: { root },
  serverExternalPackages: ["pino", "tsdav"],
};

export default nextConfig;
