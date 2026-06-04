"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";

import { EvalBar } from "./EvalBar";
import { useStockfish } from "@/hooks/useStockfish";
import { DEFAULT_DEPTH, MAX_DEPTH, MIN_DEPTH } from "@/lib/engine/constants";
import { formatScore } from "@/lib/engine/uci";
import { uciLineToSan } from "@/lib/chess/notation";
import { Badge } from "@/components/ui/badge";
import { BoardSkeleton } from "@/components/ui/board-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Orientation = "white" | "black";

export function AnalysisPlayground() {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(() => new Chess().fen());
  const [history, setHistory] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(() => describeStatus(new Chess()));
  const [orientation, setOrientation] = useState<Orientation>("white");
  const [analysisDepth, setAnalysisDepth] = useState(DEFAULT_DEPTH);
  const [showBestMove, setShowBestMove] = useState(true);
  const [mounted, setMounted] = useState(false);

  const { ready, error, isAnalyzing, evaluation, bestMove, pv, depth, analyze, stop } =
    useStockfish();

  // Avoid SSR/hydration issues from the board + worker: render after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Push the mutable game's derived values into state after each change, so the
  // render reads state (never the ref) and stays in sync.
  const sync = useCallback(() => {
    const game = gameRef.current;
    setFen(game.fen());
    setHistory(game.history());
    setStatus(describeStatus(game));
  }, []);

  // Re-analyse whenever the position, depth, or engine-readiness changes.
  useEffect(() => {
    if (!ready) return;
    stop();
    void analyze(fen, analysisDepth).catch(() => undefined);
  }, [fen, ready, analysisDepth, analyze, stop]);

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      if (!targetSquare) return false;
      try {
        gameRef.current.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
        sync();
        return true;
      } catch {
        return false; // illegal move — snap the piece back
      }
    },
    [sync],
  );

  const undo = useCallback(() => {
    gameRef.current.undo();
    sync();
  }, [sync]);

  const reset = useCallback(() => {
    gameRef.current.reset();
    sync();
  }, [sync]);

  const flip = useCallback(
    () => setOrientation((o) => (o === "white" ? "black" : "white")),
    [],
  );

  const turn = fen.split(" ")[1] === "b" ? "Black" : "White";
  const movePairs = useMemo(() => toMovePairs(history), [history]);

  const bestMoveSan = bestMove ? uciLineToSan(fen, [bestMove], 1)[0] : undefined;
  // Memoise on the PV's contents, not its (always-new) array identity.
  const pvKey = pv.join(" ");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pvSan = useMemo(() => uciLineToSan(fen, pv, 8), [fen, pvKey]);

  const arrows =
    showBestMove && bestMove
      ? [
          {
            startSquare: bestMove.slice(0, 2),
            endSquare: bestMove.slice(2, 4),
            color: "rgba(34, 197, 94, 0.7)",
          },
        ]
      : [];

  const evalText = evaluation ? formatScore(evaluation) : ready ? "…" : "—";
  const evalTone = evalToneClass(evaluation);

  return (
    <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* Board + eval bar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-stretch gap-3">
          <EvalBar score={evaluation} orientation={orientation} />
          <div className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[560px]">
              {mounted ? (
                <Chessboard
                  options={{
                    id: "play-board",
                    position: fen,
                    onPieceDrop,
                    boardOrientation: orientation,
                    arrows,
                    allowDrawingArrows: false,
                    darkSquareStyle: { backgroundColor: "#8d6a7d" },
                    lightSquareStyle: { backgroundColor: "#ece3e8" },
                    boardStyle: {
                      borderRadius: "0.5rem",
                      overflow: "hidden",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    },
                  }}
                />
              ) : (
                <BoardSkeleton />
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={undo} disabled={history.length === 0}>
            Undo
          </Button>
          <Button size="sm" variant="outline" onClick={reset} disabled={history.length === 0}>
            Reset
          </Button>
          <Button size="sm" variant="outline" onClick={flip}>
            Flip board
          </Button>
          <Button
            size="sm"
            variant={showBestMove ? "default" : "outline"}
            onClick={() => setShowBestMove((s) => !s)}
          >
            {showBestMove ? "Hide best move" : "Show best move"}
          </Button>
        </div>
      </div>

      {/* Analysis panel */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Engine analysis</span>
            <EngineStatus ready={ready} error={error} isAnalyzing={isAnalyzing} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline justify-between">
            <span className={cn("font-mono text-4xl font-semibold tabular-nums", evalTone)}>
              {evalText}
            </span>
            <span className="text-sm text-muted-foreground">depth {depth || "—"}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{turn} to move</Badge>
            {status && <Badge variant="outline">{status}</Badge>}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Best move
            </p>
            <p className="font-mono text-lg">{bestMoveSan ?? "—"}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Principal variation
            </p>
            <p className="font-mono text-sm leading-relaxed text-muted-foreground">
              {pvSan.length ? pvSan.join("  ") : "—"}
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="flex items-center justify-between text-sm">
              <span className="font-medium">Analysis depth</span>
              <span className="font-mono text-muted-foreground">{analysisDepth}</span>
            </label>
            <input
              type="range"
              min={MIN_DEPTH}
              max={MAX_DEPTH}
              value={analysisDepth}
              onChange={(e) => setAnalysisDepth(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <Separator />

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Moves
            </p>
            <MoveList pairs={movePairs} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EngineStatus({
  ready,
  error,
  isAnalyzing,
}: {
  ready: boolean;
  error: string | null;
  isAnalyzing: boolean;
}) {
  if (error) return <Badge variant="destructive">Engine error</Badge>;
  if (!ready) return <Badge variant="secondary">Loading…</Badge>;
  return (
    <Badge variant={isAnalyzing ? "default" : "secondary"}>
      {isAnalyzing ? "Thinking…" : "Idle"}
    </Badge>
  );
}

function MoveList({ pairs }: { pairs: MovePair[] }) {
  if (pairs.length === 0) {
    return <p className="text-sm text-muted-foreground">No moves yet — drag a piece to start.</p>;
  }
  return (
    <div className="max-h-48 overflow-y-auto rounded-md border">
      <table className="w-full text-sm">
        <tbody>
          {pairs.map((pair) => (
            <tr key={pair.number} className="border-b last:border-b-0">
              <td className="w-10 bg-muted/40 px-2 py-1 text-right font-mono text-muted-foreground">
                {pair.number}.
              </td>
              <td className="px-2 py-1 font-mono">{pair.white}</td>
              <td className="px-2 py-1 font-mono">{pair.black ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface MovePair {
  number: number;
  white: string;
  black?: string;
}

function toMovePairs(history: string[]): MovePair[] {
  const pairs: MovePair[] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({
      number: i / 2 + 1,
      white: history[i],
      black: history[i + 1],
    });
  }
  return pairs;
}

function describeStatus(game: Chess): string | null {
  if (game.isCheckmate()) return "Checkmate";
  if (game.isStalemate()) return "Stalemate";
  if (game.isInsufficientMaterial()) return "Draw — insufficient material";
  if (game.isThreefoldRepetition()) return "Draw — repetition";
  if (game.isDraw()) return "Draw";
  if (game.inCheck()) return "Check";
  return null;
}

function evalToneClass(score: ReturnType<typeof useStockfish>["evaluation"]): string {
  if (!score) return "text-foreground";
  const green = "text-emerald-600 dark:text-emerald-400";
  const rose = "text-rose-600 dark:text-rose-400";
  if (score.type === "mate") {
    if (score.value > 0) return green;
    if (score.value < 0) return rose;
    return "text-foreground";
  }
  if (score.value > 30) return green; // > ~0.3 pawn for White
  if (score.value < -30) return rose;
  return "text-foreground";
}
