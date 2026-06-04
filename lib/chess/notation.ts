import { Chess } from "chess.js";

/**
 * Convert a line of UCI long-algebraic moves (e.g. ["e2e4", "e7e5"]) into SAN
 * (e.g. ["e4", "e5"]) by replaying them from `fen`. Stops early if a move is
 * illegal in the resulting position (defensive — engine PVs are always legal).
 */
export function uciLineToSan(fen: string, uciMoves: string[], max = 10): string[] {
  const game = new Chess(fen);
  const san: string[] = [];
  for (const uci of uciMoves.slice(0, max)) {
    const move = uciToMoveInput(uci);
    if (!move) break;
    try {
      san.push(game.move(move).san);
    } catch {
      break;
    }
  }
  return san;
}

/** Convert a single UCI move to a {from,to,promotion} object, or null. */
export function uciToMoveInput(
  uci: string,
): { from: string; to: string; promotion?: string } | null {
  if (!uci || uci.length < 4) return null;
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;
  return promotion ? { from, to, promotion } : { from, to };
}
