import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Instrucțiunile proiectului sunt administrate explicit în AGENTS.md.
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/reports/shifts/*": ["./node_modules/pdfjs-dist/standard_fonts/LiberationSans-*.ttf"],
  },
};

export default nextConfig;
