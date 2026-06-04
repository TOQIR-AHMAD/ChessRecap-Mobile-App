"use client";

import { whiteWinProbability } from "@/lib/engine/uci";
import type { Score } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

interface EvalBarProps {
  score: Score | null;
  orientation: "white" | "black";
  className?: string;
}

/**
 * Vertical evaluation bar. The white portion grows from the side of the board
 * that White is on, sized by White's win probability.
 */
export function EvalBar({ score, orientation, className }: EvalBarProps) {
  const whiteFraction = score ? whiteWinProbability(score) : 0.5;
  const whitePct = Math.round(whiteFraction * 1000) / 10;
  const whiteOnBottom = orientation === "white";

  return (
    <div
      className={cn(
        "relative w-5 shrink-0 self-stretch overflow-hidden rounded-md bg-neutral-900",
        className,
      )}
      aria-label="Evaluation bar"
    >
      <div
        className="absolute inset-x-0 bg-neutral-50 transition-[height] duration-300 ease-out"
        style={{
          height: `${whitePct}%`,
          bottom: whiteOnBottom ? 0 : undefined,
          top: whiteOnBottom ? undefined : 0,
        }}
      />
      {/* Mid-line marker at the 50% point. */}
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-neutral-500/60" />
    </div>
  );
}
