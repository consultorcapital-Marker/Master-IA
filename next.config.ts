import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* Archivos de datos que deben viajar dentro de las funciones serverless
     (config del SDK + base SQLite inicial) */
  outputFileTracingIncludes: {
    "/api/**": ["./.z-ai-config", "./db/custom.db"],
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
