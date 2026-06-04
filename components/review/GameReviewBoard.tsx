"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Chessboard } from "react-chessboard";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  FlipVertical2,
  Lightbulb,
  Loader2,
  Sparkles,
} from "lucide-react";

import { EvalBar } from "@/components/playground/EvalBar";
import { MoveGlyph } from "@/components/review/MoveGlyph";
import { Badge } from "@/components/ui/badge";
import { BoardSkeleton } from "@/components/ui/board-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGameReview, type PlyReview } from "@/hooks/useGameReview";
import { useStockfish } from "@/hooks/useStockfish";
import { uciLineToSan } from "@/lib/chess/notation";
import { DEFAULT_DEPTH, MAX_DEPTH, MIN_DEPTH, REVIEW_DEPTH } from "@/lib/engine/constants";
import { formatScore } from "@/lib/engine/uci";
import { formatGameDate, winnerOf } from "@/lib/import/format";
import type { ImportedPlayer } from "@/lib/import/types";
import { MOVE_CLASS_META, MOVE_CLASS_ORDER } from "@/lib/review/classification";
import { useGameStore, type ReviewMove } from "@/lib/store/gameStore";
import { cn } from "@/lib/utils";

type Orientation = "white" | "black";

export function GameReviewBoard() {
  const game = useGameStore((s) => s.game);
  const moves = useGameStore((s) => s.moves);
  const startFen = useGameStore((s) => s.startFen);
  const ply = useGameStore((s) => s.ply);
  const goTo = useGameStore((s) => s.goTo);
  const first = useGameStore((s) => s.first);
  const prev = useGameStore((s) => s.prev);
  const next = useGameStore((s) => s.next);
  const last = useGameStore((s) => s.last);

  const [mounted, setMounted] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>("white");
  const [analysisDepth, setAnalysisDepth] = useState(DEFAULT_DEPTH);
  const [showBestMove, setShowBestMove] = useState(true);

  const { ready, evaluation, bestMove, pv, depth, isAnalyzing, analyze, stop } = useStockfish();
  const review = useGameReview();
  const { reset: resetReview, run: runReview } = review;
  const autoReviewedRef = useRef<string | null>(null);

  // Render the board only after mount to avoid an SSR/client hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Kick off a full review automatically the first time each game is loaded
  // (re-running is still available via the panel after a cancel).
  useEffect(() => {
    const id = game?.id ?? null;
    if (autoReviewedRef.current === id) return;
    autoReviewedRef.current = id;
    if (id && moves.length > 0) void runReview(moves, startFen, { cacheKey: id });
    else resetReview();
  }, [game?.id, moves, startFen, runReview, resetReview]);

  const currentFen = ply === 0 ? startFen : moves[ply - 1]?.fenAfter ?? startFen;
  const currentMove = ply === 0 ? null : moves[ply - 1] ?? null;
  const currentReview = currentMove ? review.byPly[currentMove.ply] : undefined;

  // Analyse the position currently on the board.
  useEffect(() => {
    if (!ready || !game) return;
    stop();
    void analyze(currentFen, analysisDepth).catch(() => undefined);
  }, [ready, game, currentFen, analysisDepth, analyze, stop]);

  // Keyboard navigation: arrows + home/end.
  useEffect(() => {
    if (!game) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          prev();
          break;
        case "ArrowRight":
          e.preventDefault();
          next();
          break;
        case "ArrowUp":
        case "Home":
          e.preventDefault();
          first();
          break;
        case "ArrowDown":
        case "End":
          e.preventDefault();
          last();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [game, prev, next, first, last]);

  const flip = useCallback(
    () => setOrientation((o) => (o === "white" ? "black" : "white")),
    [],
  );

  // Memoise on the PV's contents, not its (always-new) array identity.
  const pvKey = pv.join(" ");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pvSan = useMemo(() => uciLineToSan(currentFen, pv, 8), [currentFen, pvKey]);
  const bestMoveSan = bestMove ? uciLineToSan(currentFen, [bestMove], 1)[0] : undefined;

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

  const squareStyles = currentMove
    ? {
        [currentMove.uci.slice(0, 2)]: { background: "rgba(250, 204, 21, 0.45)" },
        [currentMove.uci.slice(2, 4)]: { background: "rgba(250, 204, 21, 0.45)" },
      }
    : {};

  // Position for the classification badge floating on the move's landing square.
  const glyphOverlay = (() => {
    if (!currentMove || !currentReview) return null;
    const dest = currentMove.uci.slice(2, 4);
    const file = dest.charCodeAt(0) - 97; // a → 0
    const rank = Number(dest[1]); // 1 → 8
    if (Number.isNaN(file) || Number.isNaN(rank)) return null;
    const colFromLeft = orientation === "white" ? file : 7 - file;
    const rowFromTop = orientation === "white" ? 8 - rank : rank - 1;
    // Centre the badge on the top-right corner of the destination square.
    return { left: (colFromLeft + 1) * 12.5, top: rowFromTop * 12.5, cls: currentReview.class };
  })();

  if (!mounted) {
    return <ReviewBoardSkeleton />;
  }

  if (!game) {
    return <EmptyState />;
  }

  const evalText = evaluation ? formatScore(evaluation) : ready ? "…" : "—";

  return (
    <div className="mx-auto grid w-full max-w-[80rem] gap-6 lg:h-[calc(100vh_-_9rem)] lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
      {/* Left column on wide screens: game info, then the review summary below it. */}
      <div className="hidden min-h-0 flex-col gap-4 overflow-y-auto xl:flex">
        <GameSummary />
        <ReviewPanel review={review} moves={moves} startFen={startFen} cacheKey={game.id} />
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div
            className="flex items-stretch gap-3"
            style={{ width: "min(100%, calc(100vh - 12rem))" }}
          >
            <EvalBar score={evaluation} orientation={orientation} />
            <div className="relative min-w-0 flex-1">
              <Chessboard
                options={{
                  id: "review-board",
                  position: currentFen,
                  boardOrientation: orientation,
                  allowDragging: false,
                  allowDrawingArrows: false,
                  arrows,
                  squareStyles,
                  darkSquareStyle: { backgroundColor: "#8d6a7d" },
                  lightSquareStyle: { backgroundColor: "#ece3e8" },
                  boardStyle: {
                    borderRadius: "0.5rem",
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  },
                }}
              />
              {glyphOverlay && (
                <div
                  className="pointer-events-none absolute z-10 drop-shadow"
                  style={{
                    left: `${glyphOverlay.left}%`,
                    top: `${glyphOverlay.top}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <MoveGlyph cls={glyphOverlay.cls} size={26} withTitle />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <NavButton onClick={first} disabled={ply === 0} label="First move">
            <ChevronsLeft className="size-4" />
          </NavButton>
          <NavButton onClick={prev} disabled={ply === 0} label="Previous move">
            <ChevronLeft className="size-4" />
          </NavButton>
          <span className="min-w-20 text-center font-mono text-sm text-muted-foreground">
            {ply} / {moves.length}
          </span>
          <NavButton onClick={next} disabled={ply === moves.length} label="Next move">
            <ChevronRight className="size-4" />
          </NavButton>
          <NavButton onClick={last} disabled={ply === moves.length} label="Last move">
            <ChevronsRight className="size-4" />
          </NavButton>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <NavButton onClick={flip} label="Flip board">
            <FlipVertical2 className="size-4" />
          </NavButton>
          <Button
            size="sm"
            variant={showBestMove ? "default" : "outline"}
            onClick={() => setShowBestMove((s) => !s)}
            className="h-11 gap-1 lg:h-7"
          >
            <Lightbulb className="size-4" />
            Best move
          </Button>
        </div>

        {/* Mobile only: engine + tabbed panels live directly under the board, so
            stepping through moves never scrolls the page away from the board. */}
        <div className="flex flex-col gap-4 lg:hidden">
          <EngineCard
            ready={ready}
            isAnalyzing={isAnalyzing}
            currentMove={currentMove}
            currentReview={currentReview}
            evalText={evalText}
            depth={depth}
            bestMoveSan={bestMoveSan}
            pvSan={pvSan}
            analysisDepth={analysisDepth}
            setAnalysisDepth={setAnalysisDepth}
          />
          <Tabs defaultValue="moves">
            <TabsList className="w-full">
              <TabsTrigger value="moves">Moves</TabsTrigger>
              <TabsTrigger value="review">Review</TabsTrigger>
              <TabsTrigger value="game">Game</TabsTrigger>
            </TabsList>
            <TabsContent value="moves">
              <Card>
                <CardContent className="p-2">
                  <MoveList moves={moves} ply={ply} onJump={goTo} byPly={review.byPly} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="review">
              <ReviewPanel review={review} moves={moves} startFen={startFen} cacheKey={game.id} />
            </TabsContent>
            <TabsContent value="game">
              <GameSummary />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Side panel (tablet/desktop): game summary (narrow only) + engine + moves */}
      <div className="hidden min-h-0 min-w-0 flex-col gap-4 lg:flex">
        <GameSummary className="xl:hidden" />

        <ReviewPanel
          className="xl:hidden"
          review={review}
          moves={moves}
          startFen={startFen}
          cacheKey={game.id}
        />

        <EngineCard
          ready={ready}
          isAnalyzing={isAnalyzing}
          currentMove={currentMove}
          currentReview={currentReview}
          evalText={evalText}
          depth={depth}
          bestMoveSan={bestMoveSan}
          pvSan={pvSan}
          analysisDepth={analysisDepth}
          setAnalysisDepth={setAnalysisDepth}
        />

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Moves</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden">
            <MoveList moves={moves} ply={ply} onJump={goTo} byPly={review.byPly} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EngineCard({
  ready,
  isAnalyzing,
  currentMove,
  currentReview,
  evalText,
  depth,
  bestMoveSan,
  pvSan,
  analysisDepth,
  setAnalysisDepth,
  className,
}: {
  ready: boolean;
  isAnalyzing: boolean;
  currentMove: ReviewMove | null;
  currentReview: PlyReview | undefined;
  evalText: string;
  depth: number;
  bestMoveSan: string | undefined;
  pvSan: string[];
  analysisDepth: number;
  setAnalysisDepth: (n: number) => void;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Engine</span>
          <Badge variant={isAnalyzing ? "default" : "secondary"}>
            {!ready ? "Loading…" : isAnalyzing ? "Thinking…" : "Idle"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentMove && currentReview && (
          <MoveVerdict move={currentMove} review={currentReview} />
        )}
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-3xl font-semibold tabular-nums">{evalText}</span>
          <span className="text-sm text-muted-foreground">depth {depth || "—"}</span>
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
        <div className="space-y-2 pt-1">
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
      </CardContent>
    </Card>
  );
}

function NavButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="icon"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="size-11 lg:size-8"
    >
      {children}
    </Button>
  );
}

function GameSummary({ className }: { className?: string }) {
  const game = useGameStore((s) => s.game);
  const headers = useGameStore((s) => s.headers);
  if (!game) return null;

  const opening = game.opening ?? headers.Opening ?? null;
  const eco = game.eco ?? headers.ECO ?? null;
  const winner = winnerOf(game.result);
  const resultText =
    winner === "white"
      ? "White wins"
      : winner === "black"
        ? "Black wins"
        : winner === "draw"
          ? "Draw"
          : "Result unknown";

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Game</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 text-sm">
        <div className="space-y-2">
          <PlayerRow color="white" player={game.white} isWinner={winner === "white"} />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Separator className="flex-1" />
            <Badge variant="outline" className="font-mono">
              {game.result}
            </Badge>
            <Separator className="flex-1" />
          </div>
          <PlayerRow color="black" player={game.black} isWinner={winner === "black"} />
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <Detail label="Result" value={resultText} />
          <Detail
            label="Time"
            value={`${game.timeControl}${game.timeClass ? ` · ${game.timeClass}` : ""}`}
          />
          <Detail label="Type" value={game.rated ? "Rated" : "Casual"} />
          <Detail label="Date" value={formatGameDate(game.endTime)} />
          {(eco || opening) && (
            <Detail label="Opening" value={`${eco ? `${eco} ` : ""}${opening ?? ""}`.trim()} />
          )}
        </dl>

        {game.url && (
          <a
            href={game.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center gap-1 pt-2 text-primary hover:underline"
          >
            View original
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </>
  );
}

function PlayerRow({
  color,
  player,
  isWinner,
}: {
  color: "white" | "black";
  player: ImportedPlayer;
  isWinner: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={cn(
          "mt-1 inline-block size-3 shrink-0 rounded-full border",
          color === "white" ? "bg-neutral-100" : "bg-neutral-800",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-tight break-words">{player.username}</p>
        <p className="text-xs text-muted-foreground">
          {player.rating != null ? player.rating : "Unrated"}
          {isWinner ? " · winner" : ""}
        </p>
      </div>
    </div>
  );
}

function MoveList({
  moves,
  ply,
  onJump,
  byPly,
}: {
  moves: ReviewMove[];
  ply: number;
  onJump: (ply: number) => void;
  byPly: Record<number, PlyReview>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  // Keep the active move visible by scrolling ONLY this list — never the page.
  // (Element.scrollIntoView would scroll the window on mobile, where this list
  // sits well below the board, yanking the user away from the board on every move.)
  useEffect(() => {
    const container = scrollRef.current;
    const active = activeRef.current;
    if (!container || !active) return;
    const c = container.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    if (a.top < c.top) {
      container.scrollTop += a.top - c.top - 8;
    } else if (a.bottom > c.bottom) {
      container.scrollTop += a.bottom - c.bottom + 8;
    }
  }, [ply]);

  const rows = useMemo(() => buildRows(moves), [moves]);

  if (moves.length === 0) {
    return <p className="text-sm text-muted-foreground">This game has no moves.</p>;
  }

  return (
    <div ref={scrollRef} className="h-full max-h-[55vh] overflow-y-auto lg:max-h-full">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.number}>
              <td className="w-9 select-none py-0.5 pr-2 text-right font-mono text-xs text-muted-foreground">
                {row.number}.
              </td>
              <MoveCell
                move={row.white}
                ply={ply}
                onJump={onJump}
                activeRef={activeRef}
                review={row.white ? byPly[row.white.ply] : undefined}
              />
              <MoveCell
                move={row.black}
                ply={ply}
                onJump={onJump}
                activeRef={activeRef}
                review={row.black ? byPly[row.black.ply] : undefined}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoveCell({
  move,
  ply,
  onJump,
  activeRef,
  review,
}: {
  move: ReviewMove | undefined;
  ply: number;
  onJump: (ply: number) => void;
  activeRef: React.RefObject<HTMLButtonElement | null>;
  review: PlyReview | undefined;
}) {
  if (!move) return <td className="py-0.5" />;
  const active = move.ply === ply;
  return (
    <td className="py-0.5">
      <button
        ref={active ? activeRef : undefined}
        type="button"
        onClick={() => onJump(move.ply)}
        className={cn(
          "flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left font-mono transition-colors hover:bg-accent",
          active && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
        )}
      >
        <span>{move.san}</span>
        {review && <MoveGlyph cls={review.class} size={14} withTitle />}
      </button>
    </td>
  );
}

interface MoveRow {
  number: number;
  white?: ReviewMove;
  black?: ReviewMove;
}

function buildRows(moves: ReviewMove[]): MoveRow[] {
  const byNumber = new Map<number, MoveRow>();
  for (const move of moves) {
    const row = byNumber.get(move.moveNumber) ?? { number: move.moveNumber };
    if (move.color === "w") row.white = move;
    else row.black = move;
    byNumber.set(move.moveNumber, row);
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

function ReviewPanel({
  review,
  moves,
  startFen,
  cacheKey,
  className,
}: {
  review: ReturnType<typeof useGameReview>;
  moves: ReviewMove[];
  startFen: string;
  cacheKey: string;
  className?: string;
}) {
  const { status, progress, summary, error, run, cancel } = review;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  // Manual runs (button / re-run) always recompute and refresh the cache.
  const runFresh = () => void run(moves, startFen, { cacheKey, force: true });

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Game review</span>
          {summary && <Badge variant="secondary">depth {REVIEW_DEPTH}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "idle" && (
          <>
            <p className="text-sm text-muted-foreground">
              Classify every move — Brilliant, Best, Inaccuracy, Blunder and more — with a
              full-game engine pass.
            </p>
            <Button onClick={runFresh} disabled={moves.length === 0} className="w-full gap-2">
              <Sparkles className="size-4" />
              Review game
            </Button>
          </>
        )}

        {(status === "loading" || status === "running") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {status === "loading"
                  ? "Loading engine…"
                  : `Analyzing ${progress.done}/${progress.total}`}
              </span>
              <button
                type="button"
                onClick={cancel}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Cancel
              </button>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-200 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">Review failed: {error}</p>
            <Button onClick={runFresh} variant="outline" className="w-full gap-2">
              <Sparkles className="size-4" />
              Try again
            </Button>
          </div>
        )}

        {status === "done" && summary && (
          <ReviewSummaryView summary={summary} onRerun={runFresh} />
        )}
      </CardContent>
    </Card>
  );
}

function ReviewSummaryView({
  summary,
  onRerun,
}: {
  summary: NonNullable<ReturnType<typeof useGameReview>["summary"]>;
  onRerun: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <AccuracyTile label="White" accuracy={summary.white.accuracy} />
        <AccuracyTile label="Black" accuracy={summary.black.accuracy} />
      </div>

      <div className="space-y-1">
        {MOVE_CLASS_ORDER.map((cls) => {
          const w = summary.white.counts[cls];
          const b = summary.black.counts[cls];
          if (!w && !b) return null;
          return (
            <div key={cls} className="flex items-center gap-2 text-sm">
              <MoveGlyph cls={cls} size={16} />
              <span className="flex-1">{MOVE_CLASS_META[cls].label}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {w} / {b}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
        <span>count: White / Black</span>
        <button type="button" onClick={onRerun} className="hover:text-foreground hover:underline">
          Re-run
        </button>
      </div>
    </div>
  );
}

function AccuracyTile({ label, accuracy }: { label: string; accuracy: number | null }) {
  return (
    <div className="rounded-lg border bg-card p-2 text-center">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-2xl font-semibold tabular-nums">
        {accuracy != null ? accuracy.toFixed(1) : "—"}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Accuracy</p>
    </div>
  );
}

function MoveVerdict({ move, review }: { move: ReviewMove; review: PlyReview }) {
  const meta = MOVE_CLASS_META[review.class];
  const playedWell =
    review.class === "brilliant" || review.class === "great" || review.class === "best";
  const bestSan = review.bestUci
    ? uciLineToSan(move.fenBefore, [review.bestUci], 1)[0]
    : undefined;

  return (
    <div
      className="flex items-center gap-2 rounded-lg border p-2"
      style={{ borderColor: `${meta.color}55` }}
    >
      <MoveGlyph cls={review.class} size={28} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          <span className="font-mono">{move.san}</span>{" "}
          <span style={{ color: meta.color }}>{meta.label}</span>
        </p>
        {!playedWell && bestSan && (
          <p className="text-xs text-muted-foreground">
            Best was <span className="font-mono">{bestSan}</span>
          </p>
        )}
      </div>
    </div>
  );
}

/** Loading placeholder that mirrors the review layout (left info, board, side panel). */
function ReviewBoardSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[80rem] gap-6 lg:h-[calc(100vh_-_9rem)] lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
      {/* Left column on wide screens */}
      <div className="hidden min-h-0 flex-col gap-4 xl:flex">
        <PanelSkeleton lines={6} />
        <PanelSkeleton lines={3} />
      </div>

      {/* Board + navigation */}
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div
            className="flex items-stretch gap-3"
            style={{ width: "min(100%, calc(100vh - 12rem))" }}
          >
            <Skeleton className="w-5 rounded-md" />
            <div className="min-w-0 flex-1">
              <BoardSkeleton />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="size-9 rounded-md" />
          ))}
          <Skeleton className="ml-1 h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Side panel */}
      <div className="flex min-h-0 min-w-0 flex-col gap-4">
        <PanelSkeleton lines={4} />
        <PanelSkeleton lines={8} grow />
      </div>
    </div>
  );
}

function PanelSkeleton({ lines, grow }: { lines: number; grow?: boolean }) {
  return (
    <Card className={grow ? "flex min-h-0 flex-1 flex-col" : undefined}>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-28" />
      </CardHeader>
      <CardContent className="flex-1 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn("h-4", i % 3 === 2 ? "w-2/3" : "w-full")} />
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">No game loaded yet.</p>
        <Link href="/" className={buttonVariants()}>
          Import a game
        </Link>
      </CardContent>
    </Card>
  );
}
