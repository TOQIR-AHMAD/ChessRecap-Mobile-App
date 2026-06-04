# Third-party notices

This project is distributed under the **GNU General Public License v3.0 or
later** (see [LICENSE](LICENSE)). It is GPL-licensed because it bundles and
distributes the **Stockfish** chess engine, which is GPLv3.

The software below is included in or used by this project. Each component
remains under its own license; full license texts ship inside the respective
packages under `node_modules/`.

## Chess engine (GPL — the reason this project is GPL)

| Component | License | Source |
| --- | --- | --- |
| **Stockfish** (WebAssembly build) | GPL-3.0-or-later | engine: <https://github.com/official-stockfish/Stockfish> · WASM build: <https://github.com/nmrugg/stockfish.js> |

The bundled engine binaries are in [`public/stockfish/`](public/stockfish/),
alongside the GPL license text (`COPYING.txt`) and a notice (`NOTICE.txt`).

## Application dependencies

| Package | License |
| --- | --- |
| next | MIT |
| react, react-dom | MIT |
| @base-ui/react | MIT |
| chess.js | BSD-2-Clause |
| react-chessboard | MIT |
| recharts | MIT |
| zustand | MIT |
| lucide-react | ISC |
| class-variance-authority | Apache-2.0 |
| clsx | MIT |
| tailwind-merge | MIT |
| tailwindcss, tw-animate-css | MIT |
| @capacitor/core, @capacitor/cli, @capacitor/android, @capacitor/ios | MIT |
| shadcn/ui (component source) | MIT |

## Fonts

| Font | License |
| --- | --- |
| Ubuntu, Ubuntu Mono (via `next/font/google`) | Ubuntu Font License 1.0 |

## Online data sources

When you enter a username, the app fetches publicly available game data from the
**Chess.com Published-Data API** and the **Lichess API**. Those services and
their data are subject to their respective terms of service.
