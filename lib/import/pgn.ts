import { Chess } from "chess.js";

import type { ImportedGame } from "./types";
import { normalizeResult, numOrNull } from "./shared";

/** Split a PGN file that may contain multiple games into per-game chunks. */
function splitPgnGames(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  // Each game's tag section begins with [Event ...]; split right before them.
  const chunks = trimmed.split(/\r?\n(?=\[Event[\s"])/g);
  return chunks.map((c) => c.trim()).filter(Boolean);
}

function parsePgnDate(date: string | null, time: string | null): number | null {
  if (!date || date.startsWith("?")) return null;
  const iso = date.replace(/\./g, "-");
  const stamp = time && !time.startsWith("?") ? `${iso}T${time}` : iso;
  const ms = Date.parse(stamp);
  return Number.isFinite(ms) ? ms : null;
}

function formatPgnTimeControl(tc: string | undefined): string {
  if (!tc || tc === "-" || tc === "?") return "—";
  if (tc.includes("/")) return "daily";
  const [base, inc] = tc.split("+");
  const baseNum = Number(base);
  if (!Number.isFinite(baseNum)) return tc;
  const baseLabel = baseNum % 60 === 0 ? `${baseNum / 60}` : `${baseNum}s`;
  return `${baseLabel}+${inc ?? 0}`;
}

/**
 * Parse pasted/uploaded PGN text into normalised games (client-side). Skips any
 * chunk that fails to parse so one bad game doesn't break the whole import.
 */
export function parsePgnGames(text: string): ImportedGame[] {
  const games: ImportedGame[] = [];

  splitPgnGames(text).forEach((chunk, index) => {
    const chess = new Chess();
    try {
      chess.loadPgn(chunk);
    } catch {
      return;
    }
    const h = chess.getHeaders();
    const hasMoves = chess.history().length > 0;
    if (!hasMoves && !h.FEN) return; // nothing to review

    games.push({
      id: `pgn-${index}-${h.White ?? "w"}-${h.Black ?? "b"}-${h.Date ?? ""}`,
      platform: "pgn",
      white: { username: h.White || "White", rating: numOrNull(h.WhiteElo) },
      black: { username: h.Black || "Black", rating: numOrNull(h.BlackElo) },
      result: normalizeResult(h.Result),
      timeControl: formatPgnTimeControl(h.TimeControl),
      timeClass: null,
      rated: false,
      endTime: parsePgnDate(h.Date ?? h.UTCDate ?? null, h.UTCTime ?? h.Time ?? null),
      pgn: chunk,
      url: h.Link || h.Site || null,
      opening: h.Opening || null,
      eco: h.ECO || null,
    });
  });

  return games;
}
