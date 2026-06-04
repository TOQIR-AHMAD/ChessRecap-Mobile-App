import type { Score } from "@/lib/engine/types";

/**
 * Chess.com-style quality label for a played move. Ordered best → worst.
 *
 * Note we deliberately leave out "Book" (no opening book is bundled) and "Miss"
 * (it overlaps heavily with Mistake/Blunder and needs tactic detection to be
 * meaningful). The eight below are all derived from the engine evaluation.
 */
export type MoveClass =
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export interface MoveClassMeta {
  /** Full label, e.g. "Brilliant". */
  label: string;
  /** Short annotation glyph shown in the badge, e.g. "!!". */
  symbol: string;
  /** Badge background colour (theme-independent hex). */
  color: string;
  /** Text/foreground colour for the badge. */
  fg: string;
  /** One-line explanation for tooltips. */
  description: string;
}

export const MOVE_CLASS_META: Record<MoveClass, MoveClassMeta> = {
  brilliant: {
    label: "Brilliant",
    symbol: "!!",
    color: "#26c2a3",
    fg: "#04231f",
    description: "A strong move that gives up material and still holds up.",
  },
  great: {
    label: "Great",
    symbol: "!",
    color: "#5b8bb0",
    fg: "#06151f",
    description: "The only move that keeps the position together.",
  },
  best: {
    label: "Best",
    symbol: "★",
    color: "#81b64c",
    fg: "#10240b",
    description: "The top engine move.",
  },
  excellent: {
    label: "Excellent",
    symbol: "✓",
    color: "#9bbd5a",
    fg: "#11240a",
    description: "Practically as good as the best move.",
  },
  good: {
    label: "Good",
    symbol: "✓",
    color: "#7a9b6a",
    fg: "#0f1a08",
    description: "A reasonable move with little lost.",
  },
  inaccuracy: {
    label: "Inaccuracy",
    symbol: "?!",
    color: "#f3c049",
    fg: "#2a1d00",
    description: "A slightly better move was available.",
  },
  mistake: {
    label: "Mistake",
    symbol: "?",
    color: "#e58f2a",
    fg: "#241300",
    description: "This move worsens the position noticeably.",
  },
  blunder: {
    label: "Blunder",
    symbol: "??",
    color: "#ca3431",
    fg: "#2a0606",
    description: "A serious error that throws away a large advantage.",
  },
};

/** Display order, best → worst, for legends and summary tables. */
export const MOVE_CLASS_ORDER: MoveClass[] = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
];

/**
 * Convert centipawns (already from the moving side's perspective) into a win
 * percentage in [0, 100]. This is the standard logistic used by Lichess/
 * chess.com-style accuracy models; it compresses huge advantages so that, say,
 * dropping +9 to +6 barely registers while +0.5 to −0.5 is a big swing.
 */
export function centipawnsToWinPercent(cp: number): number {
  const c = Math.max(-1500, Math.min(1500, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

/** Win percentage in [0, 100] from `mover`'s perspective for a White-POV score. */
export function moverWinPercent(scoreWhite: Score, mover: "w" | "b"): number {
  if (scoreWhite.type === "mate") {
    const v = mover === "w" ? scoreWhite.value : -scoreWhite.value;
    // Mate-in-0 on the board to move means that side has been mated.
    if (v === 0) return 0;
    return v > 0 ? 100 : 0;
  }
  const cp = mover === "w" ? scoreWhite.value : -scoreWhite.value;
  return centipawnsToWinPercent(cp);
}

/**
 * Per-move accuracy in [0, 100] from the drop in win percentage. Matches the
 * curve Lichess publishes: a move that loses no win% scores ~100, and accuracy
 * falls off steeply as the loss grows.
 */
export function moveAccuracy(winLoss: number): number {
  const acc = 103.1668 * Math.exp(-0.04354 * winLoss) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

export interface ClassifyInput {
  /** The move actually played, UCI long-algebraic. */
  playedUci: string;
  /** Engine's top move in the position before the move (UCI), or null. */
  bestUci: string | null;
  /** Best-play evaluation of the position BEFORE the move, White POV. */
  evalBefore: Score;
  /** Evaluation of the position AFTER the move was played, White POV. */
  evalAfter: Score;
  /** Evaluation of the engine's 2nd-best line before the move, White POV. */
  secondEval: Score | null;
  /** Side that played the move. */
  mover: "w" | "b";
  /** True when the move gives up material that is not immediately regained. */
  sacrifice: boolean;
}

export interface MoveJudgement {
  class: MoveClass;
  /** Win-percentage lost versus the best move (0 = nothing lost). */
  winLoss: number;
  /** Per-move accuracy in [0, 100]. */
  accuracy: number;
}

/**
 * Classify a single played move from engine evaluations.
 *
 * The spine is the win-percentage lost versus best play. On top of that:
 *  - matching (or all-but-matching) the engine's top move earns "Best", which
 *    is then upgraded to "Brilliant" (sound sacrifice) or "Great" (only move);
 *  - everything else falls into the Excellent → Blunder ladder by how much
 *    win% was thrown away.
 */
export function classifyMove(input: ClassifyInput): MoveJudgement {
  const { playedUci, bestUci, evalBefore, evalAfter, secondEval, mover, sacrifice } = input;

  const winBest = moverWinPercent(evalBefore, mover);
  const winPlayed = moverWinPercent(evalAfter, mover);
  const winLoss = Math.max(0, winBest - winPlayed);
  const accuracy = moveAccuracy(winLoss);

  const isTopMove = bestUci != null && playedUci === bestUci;
  const playedBest = isTopMove || winLoss <= 0.5;

  let cls: MoveClass;
  if (playedBest) {
    if (sacrifice && winPlayed >= 50 && winLoss <= 2) {
      cls = "brilliant";
    } else if (
      secondEval &&
      // The best move is much better than the second choice (an "only move"),
      // but the position is neither already winning nor lost — otherwise a
      // forced recapture would masquerade as a brilliancy.
      winBest - moverWinPercent(secondEval, mover) >= 10 &&
      winBest < 97 &&
      winPlayed >= 25
    ) {
      cls = "great";
    } else {
      cls = "best";
    }
  } else if (winLoss <= 2) {
    cls = "excellent";
  } else if (winLoss <= 5) {
    cls = "good";
  } else if (winLoss <= 10) {
    cls = "inaccuracy";
  } else if (winLoss <= 20) {
    cls = "mistake";
  } else {
    cls = "blunder";
  }

  return { class: cls, winLoss, accuracy };
}

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

/** Material totals (in pawns) for each colour from a FEN's piece placement. */
export function materialFromFen(fen: string): { w: number; b: number } {
  const placement = fen.split(" ")[0] ?? "";
  let w = 0;
  let b = 0;
  for (const ch of placement) {
    const value = PIECE_VALUE[ch.toLowerCase()];
    if (!value) continue;
    if (ch === ch.toUpperCase()) w += value;
    else b += value;
  }
  return { w, b };
}

/** Net material (own − opponent, in pawns) from `mover`'s perspective. */
export function netMaterial(fen: string, mover: "w" | "b"): number {
  const { w, b } = materialFromFen(fen);
  return mover === "w" ? w - b : b - w;
}
