import type { GameResult } from "./types";

/**
 * Chess.com's Published-Data API requires a descriptive User-Agent and will
 * reject/limit requests without one. Browsers forbid setting User-Agent on
 * fetch(), which is exactly why imports run through our server route handlers.
 * Override via env if you want to include contact info.
 */
export const USER_AGENT =
  process.env.CHESSFOLD_USER_AGENT ?? "ChessFold/1.0 (browser chess analysis app)";

/** How many recent games to surface per user. */
export const MAX_GAMES = 30;

/** Typed error carrying an HTTP status to relay back to the client. */
export class ImportError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ImportError";
    this.status = status;
  }
}

/** Permissive username check shared by both platforms. */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_.-]{1,40}$/.test(username);
}

export function numOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Normalise any PGN/result string into our four-way union. */
export function normalizeResult(result: string | undefined | null): GameResult {
  if (result === "1-0" || result === "0-1" || result === "1/2-1/2") return result;
  return "*";
}

/** Format a clock (seconds) like Lichess/Chess.com into "10+0", "3+2", "30s+0". */
export function formatClock(initialSeconds: number, incrementSeconds: number): string {
  const base =
    initialSeconds % 60 === 0 ? `${initialSeconds / 60}` : `${initialSeconds}s`;
  return `${base}+${incrementSeconds}`;
}

/** Read a single tag value out of a PGN string, e.g. pgnHeader(pgn, "Opening"). */
export function pgnHeader(pgn: string, tag: string): string | null {
  const match = pgn.match(new RegExp(`\\[${tag}\\s+"([^"]*)"\\]`));
  const value = match?.[1]?.trim();
  return value && value !== "?" && value !== "" ? value : null;
}
