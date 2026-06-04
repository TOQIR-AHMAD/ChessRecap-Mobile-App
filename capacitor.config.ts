import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.chessfold.app",
  appName: "ChessFold",
  // Static export output from `next build` (MOBILE_BUILD=1) lands here.
  webDir: "out",
  plugins: {
    // Route fetch()/XHR through the native HTTP stack on-device. This lets the
    // Chess.com / Lichess importers set a User-Agent (forbidden in browsers) and
    // sidesteps CORS — so the app needs no backend of its own.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
