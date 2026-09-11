import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Instrucțiunile proiectului sunt administrate explicit în AGENTS.md.
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  // Isolated local UI verification can run alongside the developer's server.
  distDir: process.env.NEXT_TEST_DIST_DIR || ".next",
  outputFileTracingIncludes: {
    "/api/reports/shifts/*": ["./node_modules/pdfjs-dist/standard_fonts/LiberationSans-*.ttf"],
    "/api/reports/aggregate": ["./node_modules/pdfjs-dist/standard_fonts/LiberationSans-*.ttf"],
  },
};

export default nextConfig;
