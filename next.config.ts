import type { NextConfig } from "next";

// Two build targets share this config.
//
// Web (default): keep the server features — custom headers for the Stockfish
// WASM binary and the Node import route handlers under app/api.
//
// Mobile (MOBILE_BUILD=1, via `npm run build:mobile`): emit a static export into
// `out/` for the Capacitor shell. Static exports support neither `headers()` nor
// request-reading route handlers, so those are dropped here (the build script
// also stashes app/api). On-device, imports run over native HTTP instead, and
// the WASM file is served with the right MIME type by Capacitor's web view.
const isMobileBuild = process.env.MOBILE_BUILD === "1";

const webConfig: NextConfig = {
  async headers() {
    return [
      {
        // Serve the engine binary with the correct MIME type (enables streaming
        // WASM compilation) and cache it hard — it never changes.
        source: "/stockfish/stockfish-18-lite-single.wasm",
        headers: [
          { key: "Content-Type", value: "application/wasm" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/stockfish/stockfish-18-lite-single.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

const mobileConfig: NextConfig = {
  output: "export",
  // The default image optimizer needs a server; serve images as-is in the export.
  images: { unoptimized: true },
};

const nextConfig: NextConfig = isMobileBuild ? mobileConfig : webConfig;

export default nextConfig;
