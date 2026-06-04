# ChessFold — Mobile (Capacitor)

This is the mobile build of ChessFold. It wraps the existing Next.js web app in a
native iOS/Android shell with [Capacitor](https://capacitorjs.com). The chess
engine (Stockfish 18 WASM), board, and review logic are reused **as-is** — there
is no separate native rewrite.

## How it works

One codebase, two build targets:

| Command | Target | What it does |
| --- | --- | --- |
| `npm run dev` | Web (dev) | Normal Next.js dev server for previewing in a browser. |
| `npm run build` | Web (prod) | Normal server build. Import runs through the `app/api` route handlers. |
| `npm run build:mobile` | **Mobile** | Static export (`output: 'export'`) into `out/`, then `cap sync` into `android/` + `ios/`. |

The only server-side code is the Chess.com / Lichess import (`app/api/import/*`),
which exists because browsers can't set a `User-Agent` and the APIs aren't
CORS-open. In a static export that server doesn't exist, so:

- The build (`scripts/build-mobile.mjs`) temporarily stashes `app/api` so the
  export succeeds, then restores it. Your web build is unaffected.
- On-device, imports run over **native HTTP** instead. `CapacitorHttp` (enabled in
  `capacitor.config.ts`) routes `fetch()` through native networking, which *can*
  set a `User-Agent` and ignores CORS — so **no backend is required**.
- The dispatcher that picks the transport per platform is `lib/import/client.ts`
  (`Capacitor.isNativePlatform()` → native; otherwise the web route).

## Build & run

### Android (works on Windows / macOS / Linux)

Prerequisites: [Android Studio](https://developer.android.com/studio) + a JDK.

```bash
npm install
npm run build:mobile        # static export + sync into android/
npm run cap:open:android    # opens Android Studio → press Run
```

Or build an APK from the CLI:

```bash
cd android
./gradlew assembleDebug     # APK at android/app/build/outputs/apk/debug/
```

After any change to the web app, re-run `npm run build:mobile` to refresh the
native assets.

### iOS (requires a Mac with Xcode)

The `ios/` project is already scaffolded (Capacitor 8 uses Swift Package Manager,
so no CocoaPods needed). On a Mac:

```bash
npm install
npm run build:mobile
npm run cap:open:ios        # opens Xcode → select a simulator/device → Run
```

## App identity

Set in `capacitor.config.ts`:

- `appId`: `com.chessfold.app` — change to your own reverse-domain id before
  publishing to the stores.
- `appName`: `ChessFold`

## Useful scripts

- `npm run cap:sync` — copy the latest `out/` into the native projects (run after
  `npm run build:mobile` if you only changed native config).
- `npm run cap:add:android` / `npm run cap:add:ios` — re-scaffold a platform.

## Notes / gotchas

- **Engine MIME type**: the WASM is served by Capacitor's web view, which maps
  `.wasm` to `application/wasm`. If streaming compilation ever fails on an older
  web view, the Stockfish loader falls back to array-buffer instantiation.
- **First launch size**: the engine binary is ~7 MB and ships inside the app, so
  analysis works fully offline.
- Online game import needs a network connection (it calls Chess.com / Lichess);
  PGN paste/upload and all analysis work offline.
