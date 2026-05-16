import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["node-ical"],
  outputFileTracingIncludes: {
    "**": [
      "./node_modules/temporal-polyfill/**",
      "./node_modules/rrule-temporal/**",
    ],
  },
};

export default nextConfig;
