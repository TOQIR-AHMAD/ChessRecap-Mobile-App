"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Chess, type Square } from "chess.js";
import { Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs } from "react-chessboard";
import { ArrowRight, FlipVertical2, RotateCcw, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BoardSkeleton } from "@/components/ui/board-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Orientation = "white" | "black";
type Squares = Record<string, React.CSSProperties>;

const SELECTED = "rgba(233, 84, 32, 0.40)";
const LAST_MOVE = "rgba(233, 84, 32, 0.20)";
const MOVE_DOT = "radial-gradient(circle, rgba(35, 18, 28, 0.32) 22%, transparent 24%)";
const CAPTURE_RING = "radial-gradient(circle, transparent 54%, rgba(233, 84, 32, 0.55) 56%)";

/** Hint arrow shown on the starting position to nudge a first move. */
const HINT_ARROW = { startSquare: "e2", endSquare: "e4", color: "rgba(233, 84, 32, 0.9)" };

/** A lightweight, playable board: drag or click to move, with legal moves highlighted. */
export function PlayBoard({ className }: { className?: string }) {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(() => new Chess().fen());
  const [history, setHistory] = useState<string[]>([]);
  const [status, setStatus] = useState<string>(() => describeStatus(new Chess()));
  const [orientation, setOrientation] = useState<Orientation>("white");
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [optionSquares, setOptionSquares] = useState<Squares>({});
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [mounted, setMounted] = useState(false);

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

  const clearSelection = useCallback(() => {
    setMoveFrom(null);
    setOptionSquares({});
  }, []);

  const showMoveOptions = useCallback((square: string): boolean => {
    const moves = gameRef.current.moves({ square: square as Square, verbose: true });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }
    const next: Squares = {};
    for (const move of moves) {
      next[move.to] = {
        background: move.captured ? CAPTURE_RING : MOVE_DOT,
        borderRadius: "50%",
      };
    }
    next[square] = { background: SELECTED };
    setOptionSquares(next);
    return true;
  }, []);

  const makeMove = useCallback(
    (from: string, to: string): boolean => {
      try {
        const move = gameRef.current.move({ from, to, promotion: "q" });
        sync();
        setLastMove({ from: move.from, to: move.to });
        return true;
      } catch {
        return false;
      }
    },
    [sync],
  );

  const onSquareClick = useCallback(
    ({ square }: SquareHandlerArgs) => {
      // A piece is already selected → try to move it to the clicked square.
      if (moveFrom) {
        const legal = gameRef.current
          .moves({ square: moveFrom as Square, verbose: true })
          .some((m) => m.to === square);
        if (legal) {
          makeMove(moveFrom, square);
          clearSelection();
          return;
        }
      }
      // Otherwise (re)select a piece if it has legal moves.
      const hasMoves = showMoveOptions(square);
      setMoveFrom(hasMoves ? square : null);
    },
    [moveFrom, makeMove, showMoveOptions, clearSelection],
  );

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      if (!targetSquare) return false;
      const ok = makeMove(sourceSquare, targetSquare);
      if (ok) clearSelection();
      return ok;
    },
    [makeMove, clearSelection],
  );

  const reset = useCallback(() => {
    gameRef.current.reset();
    sync();
    setLastMove(null);
    clearSelection();
  }, [clearSelection, sync]);

  const undo = useCallback(() => {
    gameRef.current.undo();
    sync();
    setLastMove(null);
    clearSelection();
  }, [clearSelection, sync]);

  const flip = useCallback(() => setOrientation((o) => (o === "white" ? "black" : "white")), []);

  const movesPlayed = history.length;

  // Nudge a first move with a hint arrow; drop it once the player gets going.
  const arrows = useMemo(() => (movesPlayed === 0 ? [HINT_ARROW] : []), [movesPlayed]);
  const hint =
    movesPlayed === 0
      ? "New to the position? Follow the arrow to open with e4."
      : "Nice move — keep going, or take it to the full board.";

  const squareStyles = useMemo<Squares>(() => {
    const styles: Squares = {};
    if (lastMove) {
      styles[lastMove.from] = { background: LAST_MOVE };
      styles[lastMove.to] = { background: LAST_MOVE };
    }
    return { ...styles, ...optionSquares };
  }, [lastMove, optionSquares]);

  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{status}</Badge>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={undo} disabled={movesPlayed === 0}>
            <Undo2 className="size-4" />
            Undo
          </Button>
          <Button size="sm" variant="outline" onClick={reset} disabled={movesPlayed === 0}>
            <RotateCcw className="size-4" />
            Reset
          </Button>
          <Button size="icon-sm" variant="outline" onClick={flip} aria-label="Flip board">
            <FlipVertical2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[460px]">
          {mounted ? (
            <Chessboard
              options={{
                id: "home-play-board",
                position: fen,
                boardOrientation: orientation,
                onPieceDrop,
                onSquareClick,
                allowDrawingArrows: false,
                arrows,
                squareStyles,
                darkSquareStyle: { backgroundColor: "#8d6a7d" },
                lightSquareStyle: { backgroundColor: "#ece3e8" },
                boardStyle: {
                  borderRadius: "0.5rem",
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                },
              }}
            />
          ) : (
            <BoardSkeleton />
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2.5 border-t pt-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-sm text-muted-foreground">{hint}</p>
        <Link
          href="/analysis"
          className={cn(buttonVariants({ size: "sm" }), "w-full sm:w-auto")}
        >
          Play on the full board
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function describeStatus(game: Chess): string {
  const turn = game.turn() === "w" ? "White" : "Black";
  if (game.isCheckmate()) return `Checkmate — ${turn === "White" ? "Black" : "White"} wins`;
  if (game.isStalemate()) return "Stalemate";
  if (game.isDraw()) return "Draw";
  if (game.inCheck()) return `${turn} to move · Check`;
  return `${turn} to move`;
}
