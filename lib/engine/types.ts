/** A chess evaluation, either a centipawn score or a forced mate. */
export type Score =
  | { type: "cp"; value: number } // centipawns (100 = one pawn)
  | { type: "mate"; value: number }; // moves until mate; sign = who is mating

/** One parsed `info` line from the engine (a candidate principal variation). */
export interface EngineInfo {
  depth: number;
  seldepth?: number;
  /** 1-based index of this line when MultiPV > 1. */
  multipv: number;
  /** Score from the side-to-move's perspective, exactly as UCI reports it. */
  score: Score;
  /** Same score normalised to White's perspective (positive = White better). */
  scoreWhite: Score;
  /** Principal variation as UCI long-algebraic moves, e.g. ["e2e4", "e7e5"]. */
  pv: string[];
  nodes?: number;
  nps?: number;
  timeMs?: number;
}

/** The result of analysing a single position to completion. */
export interface AnalysisResult {
  fen: string;
  /** Depth actually reached. */
  depth: number;
  /** Final evaluation from White's perspective (positive = White better). */
  evaluation: Score;
  /** Final evaluation from the side-to-move's perspective. */
  evaluationRelative: Score;
  /** Engine's best move in UCI long-algebraic notation; null if no legal move. */
  bestMove: string | null;
  /** Principal variation (UCI moves) backing the evaluation. */
  pv: string[];
  /**
   * All candidate lines at the final depth, sorted by `multipv` (1 = best).
   * Only longer than one entry when analysed with MultiPV > 1; used by the game
   * review to tell an "only move" apart from one of several equal options.
   */
  lines: EngineInfo[];
  /** True if this request was superseded by a newer one before it could run. */
  cancelled?: boolean;
}

export type EngineStatus = "loading" | "ready" | "analyzing" | "error";
