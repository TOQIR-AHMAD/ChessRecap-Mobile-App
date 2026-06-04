import { cn } from "@/lib/utils";

/**
 * A chessboard-shaped loading placeholder: an 8×8 grid of muted squares that
 * pulses, so the board area reads as "a board, loading" rather than a blank box.
 * Sits in the same square footprint as the real board (use the parent's width).
 */
export function BoardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("grid aspect-square w-full animate-pulse overflow-hidden rounded-lg", className)}
      style={{ gridTemplateColumns: "repeat(8, 1fr)", gridTemplateRows: "repeat(8, 1fr)" }}
      aria-hidden
    >
      {Array.from({ length: 64 }).map((_, i) => {
        const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
        return <div key={i} className={dark ? "bg-muted-foreground/15" : "bg-muted"} />;
      })}
    </div>
  );
}
