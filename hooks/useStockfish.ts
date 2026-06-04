"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_DEPTH } from "@/lib/engine/constants";
import { UciEngine } from "@/lib/engine/engine";
import type { AnalysisResult, EngineInfo, Score } from "@/lib/engine/types";

export interface UseStockfish {
  /** Engine has loaded and finished UCI negotiation. */
  ready: boolean;
  /** Non-null if the worker failed to start. */
  error: string | null;
  /** A search is currently running. */
  isAnalyzing: boolean;
  /** Latest evaluation from White's perspective (streams as depth increases). */
  evaluation: Score | null;
  /** Engine's current best move (UCI long-algebraic). */
  bestMove: string | null;
  /** Current principal variation (UCI moves). */
  pv: string[];
  /** Depth reached so far. */
  depth: number;
  /** Analyse a FEN. Calling again supersedes the previous request. */
  analyze: (fen: string, depth?: number) => Promise<AnalysisResult>;
  /** Stop the in-flight search early. */
  stop: () => void;
}

/**
 * React binding for {@link UciEngine}. Owns a single worker for the component's
 * lifetime and exposes the live evaluation as state plus an `analyze` promise.
 */
export function useStockfish(): UseStockfish {
  const engineRef = useRef<UciEngine | null>(null);
  const generationRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [evaluation, setEvaluation] = useState<Score | null>(null);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [pv, setPv] = useState<string[]>([]);
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    let mounted = true;
    const engine = new UciEngine();
    engineRef.current = engine;
    engine
      .init()
      .then(() => mounted && setReady(true))
      .catch((err) => mounted && setError(err?.message ?? String(err)));

    return () => {
      mounted = false;
      engine.quit();
      engineRef.current = null;
    };
  }, []);

  const analyze = useCallback((fen: string, searchDepth: number = DEFAULT_DEPTH) => {
    const engine = engineRef.current;
    if (!engine) return Promise.reject(new Error("Engine not initialised"));

    const generation = ++generationRef.current;
    setIsAnalyzing(true);

    const onUpdate = (info: EngineInfo) => {
      if (generation !== generationRef.current) return;
      setEvaluation(info.scoreWhite);
      setPv(info.pv);
      setDepth(info.depth);
      setBestMove(info.pv[0] ?? null);
    };

    return engine.analyze(fen, { depth: searchDepth }, onUpdate).then((result) => {
      if (generation === generationRef.current) {
        if (!result.cancelled) {
          setEvaluation(result.evaluation);
          setBestMove(result.bestMove);
          setPv(result.pv);
          setDepth(result.depth);
        }
        setIsAnalyzing(false);
      }
      return result;
    });
  }, []);

  const stop = useCallback(() => engineRef.current?.stop(), []);

  return { ready, error, isAnalyzing, evaluation, bestMove, pv, depth, analyze, stop };
}
