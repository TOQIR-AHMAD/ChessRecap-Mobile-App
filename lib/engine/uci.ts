import type { EngineInfo, Score } from "./types";

/** Extract the side to move ("w" | "b") from a FEN string. */
export function fenTurn(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

/**
 * UCI reports scores relative to the side to move. Flip to White's perspective
 * so that positive always means "good for White" (handy for bars and graphs).
 */
export function normalizeToWhite(score: Score, turn: "w" | "b"): Score {
  if (turn === "w") return score;
  return score.type === "cp"
    ? { type: "cp", value: -score.value }
    : { type: "mate", value: -score.value };
}

/**
 * Parse a single `info ...` line from the engine. Returns null for lines that
 * carry no evaluation (e.g. `info string`, `info currmove`).
 */
export function parseInfoLine(line: string, turn: "w" | "b"): EngineInfo | null {
  if (!line.startsWith("info ") || line.startsWith("info string")) return null;

  const t = line.split(/\s+/);
  let depth: number | undefined;
  let seldepth: number | undefined;
  let multipv = 1;
  let nodes: number | undefined;
  let nps: number | undefined;
  let timeMs: number | undefined;
  let score: Score | null = null;
  let pv: string[] = [];

  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case "depth":
        depth = Number(t[++i]);
        break;
      case "seldepth":
        seldepth = Number(t[++i]);
        break;
      case "multipv":
        multipv = Number(t[++i]);
        break;
      case "nodes":
        nodes = Number(t[++i]);
        break;
      case "nps":
        nps = Number(t[++i]);
        break;
      case "time":
        timeMs = Number(t[++i]);
        break;
      case "score": {
        const kind = t[++i];
        const value = Number(t[++i]);
        if (kind === "cp") score = { type: "cp", value };
        else if (kind === "mate") score = { type: "mate", value };
        break;
      }
      case "pv":
        pv = t.slice(i + 1);
        i = t.length; // pv is always last
        break;
      default:
        break;
    }
  }

  if (depth === undefined || score === null) return null;
  return {
    depth,
    seldepth,
    multipv,
    score,
    scoreWhite: normalizeToWhite(score, turn),
    pv,
    nodes,
    nps,
    timeMs,
  };
}

/** Parse the move out of a `bestmove ...` line. Null when there is no move. */
export function parseBestMove(line: string): string | null {
  const move = line.split(/\s+/)[1];
  return !move || move === "(none)" ? null : move;
}

/** Human-readable score from White's perspective, e.g. "+1.34", "-0.20", "M5". */
export function formatScore(scoreWhite: Score): string {
  if (scoreWhite.type === "mate") {
    if (scoreWhite.value === 0) return "#";
    return (scoreWhite.value > 0 ? "M" : "-M") + Math.abs(scoreWhite.value);
  }
  const pawns = scoreWhite.value / 100;
  return (pawns > 0 ? "+" : "") + pawns.toFixed(2);
}

/**
 * White's win probability in [0, 1] for an evaluation. Used for the eval bar
 * fill and (later) for accuracy. Logistic curve with an Elo-style 1/400 scale.
 */
export function whiteWinProbability(scoreWhite: Score): number {
  if (scoreWhite.type === "mate") {
    if (scoreWhite.value === 0) return 0.5;
    return scoreWhite.value > 0 ? 1 : 0;
  }
  return 1 / (1 + Math.pow(10, -scoreWhite.value / 400));
}

/** A bounded numeric value (in pawns) for plotting an evaluation graph. */
export function scoreToPlotValue(scoreWhite: Score, clampPawns = 10): number {
  if (scoreWhite.type === "mate") {
    const sign = scoreWhite.value === 0 ? 0 : Math.sign(scoreWhite.value);
    return sign * clampPawns;
  }
  const pawns = scoreWhite.value / 100;
  return Math.max(-clampPawns, Math.min(clampPawns, pawns));
}
