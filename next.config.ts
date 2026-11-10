import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Keep jsdom (and its CJS deps) outside the Turbopack bundle
  serverExternalPackages: ["jsdom", "html-encoding-sniffer", "whatwg-encoding", "whatwg-url"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Avoid picking up a parent-directory package-lock on Windows home folders
  turbopack: {
    root,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
