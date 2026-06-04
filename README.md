# ChessFold

A free, browser-based chess analysis platform. Enter a Chess.com or Lichess
username (or paste a PGN), pick a game, and get a full analysis report — every
move graded, an accuracy score, the opening name, an evaluation graph, and the
engine's best move for every position.

Analysis is **free and unlimited** because the engine (Stockfish, compiled to
WebAssembly) runs entirely **client-side in your browser** — there is no paid
analysis server.

> Status: **Phases 1 & 3 complete** — interactive analysis board with a live
> Stockfish evaluation, plus game import from Chess.com / Lichess / PGN with a
> step-through review board. Phase 4 adds the full graded game-review report.

## Tech stack

| Concern      | Choice                                                            |
| ------------ | ---------------------------------------------------------------- |
| Framework    | Next.js (App Router) + TypeScript (strict)                       |
| Styling / UI | Tailwind CSS v4 + shadcn/ui                                      |
| Chess logic  | [chess.js](https://github.com/jhlywa/chess.js)                  |
| Board UI     | [react-chessboard](https://github.com/Clariity/react-chessboard) |
| Engine       | Stockfish 18 (WASM, lite single-threaded) in a Web Worker        |
| Charts       | Recharts                                                         |
| Client state | Zustand                                                         |

## Getting started

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**.

You can:

- Drag pieces to make legal moves (validated by chess.js).
- Watch the **eval bar** and **engine analysis panel** update live as Stockfish
  searches deeper.
- Toggle the **best-move arrow**, change the **analysis depth**, and undo / reset
  / flip the board.

The first analysis after a fresh load takes a moment while the ~7 MB engine
binary downloads and compiles; the browser then caches it.

## Architecture overview

```
app/                     Next.js routes (App Router)
  layout.tsx             Shell + ChessFold branding + nav
  page.tsx               Free-play analysis board
  import/page.tsx        Game import screen
  review/page.tsx        Step-through review of a loaded game
  api/import/
    chesscom/route.ts    Server route — fetches Chess.com Published-Data API
    lichess/route.ts     Server route — fetches Lichess API (NDJSON)
components/
  playground/            Free-play board + eval bar + analysis panel
  import/                Import panel, game list, profile card
  review/                Game review board (navigation + engine)
  ui/                    shadcn/ui primitives
hooks/
  useStockfish.ts        React binding for the engine worker
lib/
  engine/                Engine layer (no React) — UciEngine, UCI parsing
  chess/                 Reusable chess helpers (UCI <-> SAN)
  import/                Game import: per-platform loaders + normalisation + PGN
  store/gameStore.ts     Zustand store: loaded game + step-through navigation
public/
  stockfish/             Stockfish WASM engine (loader + .wasm)
```

### Why game import runs server-side

Imports go through Next.js **route handlers** rather than fetching from the
browser, for two reasons:

- **Chess.com requires a `User-Agent` header**, which browsers forbid `fetch`
  from setting.
- It avoids cross-origin (CORS) restrictions and centralises error/rate-limit
  handling and normalisation.

The routes fetch the public APIs (Chess.com archives + profile/stats, Lichess
NDJSON game export + profile), normalise both platforms into one `ImportedGame`
shape, and return clean JSON. Pasted/uploaded PGN is parsed entirely
client-side. The engine remains 100% client-side — only lightweight data
fetching is on the server.

### How the engine works

- The engine runs in a **Web Worker** (loaded from `public/stockfish/`), so
  searching never blocks the UI thread.
- We ship the **lite, single-threaded** Stockfish 18 build. It needs **no
  cross-origin isolation** (no `SharedArrayBuffer` / COOP+COEP headers), which
  keeps deployment simple, and it is still far stronger than any human.
- `UciEngine` speaks the [UCI protocol](https://www.chessprogramming.org/UCI)
  and exposes a single method:

  ```ts
  analyze(fen, { depth }, onUpdate?) => Promise<{
    evaluation,          // White's perspective (cp or mate)
    evaluationRelative,  // side-to-move perspective
    bestMove,            // UCI long-algebraic
    pv,                  // principal variation
    depth,
  }>
  ```

  Requests are **latest-wins**: starting a new analysis stops the in-flight
  search, which keeps the interactive board snappy. `onUpdate` streams each
  improved line so the UI deepens the evaluation in real time.

## License / attribution

ChessFold is original work. Stockfish is licensed under the GPLv3; the bundled
WASM build comes from [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js).
# ChessRecap
# ChessRecap-Mobile-App
