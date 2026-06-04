import type { GameResult, ImportedGame, ImportedPlayer, ImportedProfile, ImportResponse } from "./types";
import { ImportError, MAX_GAMES, USER_AGENT, formatClock } from "./shared";

const BASE = "https://lichess.org/api";

interface RawLichessUser {
  name?: string;
  id?: string;
  title?: string;
}
interface RawLichessPlayer {
  user?: RawLichessUser;
  rating?: number;
  aiLevel?: number;
}
interface RawLichessGame {
  id: string;
  rated?: boolean;
  variant?: string;
  speed?: string;
  status?: string;
  createdAt?: number;
  lastMoveAt?: number;
  winner?: "white" | "black";
  players?: { white?: RawLichessPlayer; black?: RawLichessPlayer };
  opening?: { eco?: string; name?: string };
  clock?: { initial?: number; increment?: number };
  daysPerTurn?: number;
  pgn?: string;
}

function player(p: RawLichessPlayer | undefined): ImportedPlayer {
  if (!p) return { username: "Anonymous", rating: null };
  if (p.aiLevel) return { username: `Stockfish level ${p.aiLevel}`, rating: null };
  return {
    username: p.user?.name ?? p.user?.id ?? "Anonymous",
    rating: typeof p.rating === "number" ? p.rating : null,
  };
}

function resultFromLichess(g: RawLichessGame): GameResult {
  if (g.winner === "white") return "1-0";
  if (g.winner === "black") return "0-1";
  if (g.status === "draw" || g.status === "stalemate") return "1/2-1/2";
  return "*";
}

function timeControl(g: RawLichessGame): string {
  if (g.clock && typeof g.clock.initial === "number") {
    return formatClock(g.clock.initial, g.clock.increment ?? 0);
  }
  if (g.daysPerTurn) return `${g.daysPerTurn}d/move`;
  return g.speed ?? "—";
}

function normalizeGame(g: RawLichessGame): ImportedGame {
  return {
    id: g.id,
    platform: "lichess",
    white: player(g.players?.white),
    black: player(g.players?.black),
    result: resultFromLichess(g),
    timeControl: timeControl(g),
    timeClass: g.speed ?? null,
    rated: g.rated ?? false,
    endTime: g.lastMoveAt ?? g.createdAt ?? null,
    pgn: g.pgn ?? "",
    url: `https://lichess.org/${g.id}`,
    opening: g.opening?.name ?? null,
    eco: g.opening?.eco ?? null,
  };
}

function pickRating(perfs: Record<string, { rating?: number; games?: number }> | undefined): number | null {
  if (!perfs) return null;
  let best: { rating: number; games: number } | null = null;
  for (const key of ["rapid", "blitz", "bullet", "classical", "correspondence"]) {
    const perf = perfs[key];
    if (perf?.rating && (perf.games ?? 0) > 0) {
      if (!best || (perf.games ?? 0) > best.games) {
        best = { rating: perf.rating, games: perf.games ?? 0 };
      }
    }
  }
  return best?.rating ?? null;
}

function normalizeProfile(p: Record<string, unknown>): ImportedProfile {
  const username = (p.username as string) ?? (p.id as string) ?? "";
  return {
    platform: "lichess",
    username,
    name: ((p.profile as Record<string, unknown>)?.realName as string) ?? null,
    title: (p.title as string) ?? null,
    avatar: null, // Lichess does not expose avatars via the API
    rating: pickRating(p.perfs as Record<string, { rating?: number; games?: number }>),
    url: (p.url as string) ?? `https://lichess.org/@/${username}`,
  };
}

export async function loadLichess(username: string): Promise<ImportResponse> {
  const headers = { "User-Agent": USER_AGENT };

  const profileRes = await fetch(`${BASE}/user/${encodeURIComponent(username)}`, {
    headers: { ...headers, Accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (profileRes.status === 404) {
    throw new ImportError("No Lichess player found with that username.", 404);
  }
  if (profileRes.status === 429) {
    throw new ImportError("Lichess is rate-limiting requests. Wait a moment and try again.", 429);
  }
  if (!profileRes.ok) {
    throw new ImportError("Lichess is unavailable right now. Try again later.", 502);
  }
  const profileJson = (await profileRes.json()) as Record<string, unknown>;

  const params = new URLSearchParams({
    max: String(MAX_GAMES),
    pgnInJson: "true",
    opening: "true",
    clocks: "false",
    evals: "false",
  });
  const gamesRes = await fetch(`${BASE}/games/user/${encodeURIComponent(username)}?${params}`, {
    headers: { ...headers, Accept: "application/x-ndjson" },
    next: { revalidate: 60 },
  });
  if (gamesRes.status === 429) {
    throw new ImportError("Lichess is rate-limiting requests. Wait a moment and try again.", 429);
  }
  if (!gamesRes.ok) {
    throw new ImportError("Lichess is unavailable right now. Try again later.", 502);
  }

  const text = await gamesRes.text();
  const games = text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as RawLichessGame)
    .filter((g) => (g.variant ?? "standard") === "standard" && g.status !== "aborted" && g.pgn)
    .map(normalizeGame);

  return { profile: normalizeProfile(profileJson), games };
}
