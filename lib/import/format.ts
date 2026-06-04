import type { GameResult } from "./types";

/** Format a ms timestamp as a short local date, e.g. "Jun 3, 2026". */
export function formatGameDate(ms: number | null): string {
  if (!ms) return "Unknown date";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Which side (if any) won — used to bold the winner in the game list. */
export function winnerOf(result: GameResult): "white" | "black" | "draw" | "unknown" {
  if (result === "1-0") return "white";
  if (result === "0-1") return "black";
  if (result === "1/2-1/2") return "draw";
  return "unknown";
}
