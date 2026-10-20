import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (the built-in local database) ships its own files, so Next.js
  // must load it as-is instead of bundling it.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
