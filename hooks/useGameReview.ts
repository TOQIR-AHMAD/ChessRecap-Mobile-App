"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";

import { uciToMoveInput } from "@/lib/chess/notation";
import {
  REVIEW_DEPTH,
  REVIEW_HASH_MB,
  REVIEW_MAX_WORKERS,
  REVIEW_MULTIPV,
} from "@/lib/engine/constants";
import { UciEngine } from "@/lib/engine/engine";
import type { Score } from "@/lib/engine/types";
import {
  classifyMove,
  MOVE_CLASS_ORDER,
  netMaterial,
  type MoveClass,
} from "@/lib/review/classification";
import type { ReviewMove } from "@/lib/store/gameStore";

/** Verdict for a single played half-move. */
export interface PlyReview {
  ply: number;
  class: MoveClass;
  /** Win-percentage lost versus the best move. */
  winLoss: number;
  /** Per-move accuracy in [0, 100]. */
  accuracy: number;
  /** Engine's best move (UCI) in the position before this move was played. */
  bestUci: string | null;
  /** Evaluation before and after the move, both from White's perspective. */
  evalBefore: Score;
  evalAfter: Score;
}

type ClassCounts = Record<MoveClass, number>;

export interface SideSummary {
  /** Average accuracy in [0, 100], or null when the side made no moves. */
  accuracy: number | null;
  moves: number;
  counts: ClassCounts;
}

export interface ReviewSummary {
  white: SideSummary;
  black: SideSummary;
}

export type ReviewStatus = "idle" | "loading" | "running" | "done" | "error";

export interface UseGameReview {
  status: ReviewStatus;
  error: string | null;
  /** Positions analysed so far / total to analyse. */
  progress: { done: number; total: number };
  /** Verdicts keyed by ply (1-based). Empty until a review completes. */
  byPly: Record<number, PlyReview>;
  summary: ReviewSummary | null;
  /**
   * Run a full-game review pass. When `cacheKey` is given (e.g. the game id),
   * results are read from / written to localStorage so a refresh or revisit is
   * instant; pass `force` to recompute and overwrite the cache.
   */
  run: (
    moves: ReviewMove[],
    startFen: string,
    opts?: { cacheKey?: string; force?: boolean },
  ) => Promise<void>;
  /** Abort an in-flight review. */
  cancel: () => void;
  /** Clear all results (e.g. when a new game loads). */
  reset: () => void;
}

interface PositionEval {
  scoreWhite: Score;
  bestUci: string | null;
  secondScoreWhite: Score | null;
}

function emptyCounts(): ClassCounts {
  return MOVE_CLASS_ORDER.reduce((acc, c) => {
    acc[c] = 0;
    return acc;
  }, {} as ClassCounts);
}

/** True when `move` gives up at least a minor piece that isn't won straight back. */
function detectSacrifice(move: ReviewMove, oppBestUci: string | null): boolean {
  const before = netMaterial(move.fenBefore, move.color);
  let settledFen = move.fenAfter;
  if (oppBestUci) {
    try {
      const chess = new Chess(move.fenAfter);
      const input = uciToMoveInput(oppBestUci);
      if (input) {
        chess.move(input);
        settledFen = chess.fen();
      }
    } catch {
      // Fall back to the raw post-move position.
    }
  }
  return before - netMaterial(settledFen, move.color) >= 2;
}

interface CachedReview {
  byPly: Record<number, PlyReview>;
  summary: ReviewSummary;
}

// Bump when the scoring changes so stale results aren't served. Depth is part
// of the key because a different depth can change the verdicts.
const CACHE_PREFIX = `chessfold:review:v1:d${REVIEW_DEPTH}:`;

function cacheKeyFor(gameId: string): string {
  return CACHE_PREFIX + gameId;
}

function loadCachedReview(key: string): CachedReview | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CachedReview) : null;
  } catch {
    return null;
  }
}

function saveCachedReview(key: string, data: CachedReview): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Likely a quota error: drop our cached reviews and try once more.
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("chessfold:review:")) localStorage.removeItem(k);
      }
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // Give up — the review just won't be cached this time.
    }
  }
}

/** How many parallel review workers to use, clamped to the machine's cores. */
function workerCount(): number {
  const cores = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4;
  // Leave a core for the UI and the board's own engine.
  return Math.max(1, Math.min(REVIEW_MAX_WORKERS, cores - 1));
}

/**
 * Full-game review: evaluates every position with a pool of dedicated Stockfish
 * workers (separate from the interactive board's engine) and turns the
 * evaluations into per-move classifications and per-side accuracy.
 *
 * The worker pool is created lazily on the first {@link UseGameReview.run} so
 * users who never request a review don't pay for extra workers, and positions
 * are searched across the pool concurrently to keep the pass fast.
 */
export function useGameReview(): UseGameReview {
  const enginesRef = useRef<UciEngine[]>([]);
  const generationRef = useRef(0);

  const [status, setStatus] = useState<ReviewStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [byPly, setByPly] = useState<Record<number, PlyReview>>({});
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  useEffect(() => {
    // On unmount, invalidate any in-flight run and tear down the workers. We
    // intentionally read the latest ref values here, not the mount-time ones.
    const generation = generationRef;
    const engines = enginesRef;
    return () => {
      generation.current++;
      engines.current.forEach((e) => e.quit());
      engines.current = [];
    };
  }, []);

  const reset = useCallback(() => {
    generationRef.current++;
    enginesRef.current.forEach((e) => e.stop());
    setStatus("idle");
    setError(null);
    setProgress({ done: 0, total: 0 });
    setByPly({});
    setSummary(null);
  }, []);

  const cancel = useCallback(() => {
    generationRef.current++;
    enginesRef.current.forEach((e) => e.stop());
    setStatus((s) => (s === "running" || s === "loading" ? "idle" : s));
  }, []);

  const run = useCallback<UseGameReview["run"]>(async (moves, startFen, opts) => {
    if (moves.length === 0) return;

    const generation = ++generationRef.current;
    const cacheKey = opts?.cacheKey ? cacheKeyFor(opts.cacheKey) : null;
    setError(null);

    // Serve a cached review instantly unless a fresh run was requested.
    if (cacheKey && !opts?.force) {
      const cached = loadCachedReview(cacheKey);
      if (cached) {
        setByPly(cached.byPly);
        setSummary(cached.summary);
        setProgress({ done: moves.length + 1, total: moves.length + 1 });
        setStatus("done");
        return;
      }
    }

    setByPly({});
    setSummary(null);
    setProgress({ done: 0, total: moves.length + 1 });

    // Lazily boot a pool of dedicated engines for the review pass.
    let engines = enginesRef.current;
    if (engines.length === 0) {
      setStatus("loading");
      engines = Array.from({ length: workerCount() }, () => new UciEngine(REVIEW_HASH_MB));
      enginesRef.current = engines;
    }
    try {
      await Promise.all(engines.map((e) => e.init()));
    } catch (err) {
      if (generation !== generationRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
      return;
    }
    if (generation !== generationRef.current) return;

    setStatus("running");

    // Positions to evaluate: the start, then the position after each move.
    // Position k is the position *before* move k+1, so a single sweep gives us
    // both the "best you could do" and "what you got" for every ply.
    const fens = [startFen, ...moves.map((m) => m.fenAfter)];
    const evals: PositionEval[] = new Array(fens.length);

    // Fan the positions out across the pool: each engine pulls the next index
    // and searches it, so all workers stay busy until the queue drains.
    let nextIndex = 0;
    let done = 0;
    let failure: unknown = null;

    const worker = async (engine: UciEngine) => {
      while (failure === null) {
        if (generation !== generationRef.current) return;
        const k = nextIndex++;
        if (k >= fens.length) return;
        let result;
        try {
          result = await engine.analyze(fens[k], {
            depth: REVIEW_DEPTH,
            multiPv: REVIEW_MULTIPV,
          });
        } catch (err) {
          failure = err;
          return;
        }
        if (generation !== generationRef.current) return;
        const second = result.lines.find((l) => l.multipv === 2);
        evals[k] = {
          scoreWhite: result.evaluation,
          bestUci: result.bestMove,
          secondScoreWhite: second?.scoreWhite ?? null,
        };
        setProgress({ done: ++done, total: fens.length });
      }
    };

    await Promise.all(engines.map(worker));

    if (generation !== generationRef.current) return; // cancelled mid-run
    if (failure !== null) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setStatus("error");
      return;
    }

    // Turn position evaluations into per-move verdicts.
    const verdicts: Record<number, PlyReview> = {};
    const sides: Record<"w" | "b", { total: number; moves: number; counts: ClassCounts }> = {
      w: { total: 0, moves: 0, counts: emptyCounts() },
      b: { total: 0, moves: 0, counts: emptyCounts() },
    };

    moves.forEach((move, i) => {
      const before = evals[i];
      const after = evals[i + 1];
      const sacrifice = detectSacrifice(move, after.bestUci);

      const judgement = classifyMove({
        playedUci: move.uci,
        bestUci: before.bestUci,
        evalBefore: before.scoreWhite,
        evalAfter: after.scoreWhite,
        secondEval: before.secondScoreWhite,
        mover: move.color,
        sacrifice,
      });

      // A checkmating move is, by definition, perfect — don't let a quirky
      // mate-score reading dent its accuracy.
      const isMate = move.san.endsWith("#");
      const winLoss = isMate ? 0 : judgement.winLoss;
      const accuracy = isMate ? 100 : judgement.accuracy;

      verdicts[move.ply] = {
        ply: move.ply,
        class: judgement.class,
        winLoss,
        accuracy,
        bestUci: before.bestUci,
        evalBefore: before.scoreWhite,
        evalAfter: after.scoreWhite,
      };

      const side = sides[move.color];
      side.total += accuracy;
      side.moves += 1;
      side.counts[judgement.class] += 1;
    });

    if (generation !== generationRef.current) return;

    const reviewSummary: ReviewSummary = {
      white: {
        accuracy: sides.w.moves ? round1(sides.w.total / sides.w.moves) : null,
        moves: sides.w.moves,
        counts: sides.w.counts,
      },
      black: {
        accuracy: sides.b.moves ? round1(sides.b.total / sides.b.moves) : null,
        moves: sides.b.moves,
        counts: sides.b.counts,
      },
    };

    setByPly(verdicts);
    setSummary(reviewSummary);
    setStatus("done");
    if (cacheKey) saveCachedReview(cacheKey, { byPly: verdicts, summary: reviewSummary });
  }, []);

  return useMemo(
    () => ({ status, error, progress, byPly, summary, run, cancel, reset }),
    [status, error, progress, byPly, summary, run, cancel, reset],
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
