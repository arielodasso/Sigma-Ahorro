import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "postgres", "tesseract.js", "exceljs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  poweredByHeader: false,
  reactStrictMode: true,
  // @ts-ignore
  darkMode: "class",
};

export default nextConfig;
