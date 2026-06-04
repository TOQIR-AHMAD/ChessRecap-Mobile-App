import type { ImportedGame, ImportedProfile, ImportResponse } from "./types";
import { ImportError, MAX_GAMES, USER_AGENT, pgnHeader } from "./shared";

const BASE = "https://api.chess.com/pub";
const MAX_ARCHIVES_SCANNED = 3;

interface RawChessComPlayer {
  username?: string;
  rating?: number;
  result?: string;
}

interface RawChessComGame {
  uuid?: string;
  url?: string;
  pgn?: string;
  time_control?: string;
  time_class?: string;
  end_time?: number;
  rated?: boolean;
  rules?: string;
  white?: RawChessComPlayer;
  black?: RawChessComPlayer;
}

async function ccFetch(url: string, init?: { cache?: "no-store" }): Promise<Response> {
  // Small endpoints (profile/stats/archive list) cache briefly; monthly archives
  // can exceed Next's 2MB data-cache limit, so callers pass cache: "no-store".
  const caching: RequestInit = init?.cache
    ? { cache: init.cache }
    : { next: { revalidate: 60 } };
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    ...caching,
  });
}

/** Map a Chess.com per-side result code to an overall game result. */
function resultFromChessCom(white?: RawChessComPlayer, black?: RawChessComPlayer): "1-0" | "0-1" | "1/2-1/2" {
  if (white?.result === "win") return "1-0";
  if (black?.result === "win") return "0-1";
  return "1/2-1/2";
}

/** "600" -> "10+0", "180+2" -> "3+2", "1/259200" -> "3d/move". */
function formatTimeControl(tc: string | undefined): string {
  if (!tc) return "—";
  if (tc.includes("/")) {
    const perMove = Number(tc.split("/")[1]);
    if (Number.isFinite(perMove)) {
      const days = Math.round(perMove / 86400);
      if (days >= 1) return `${days}d/move`;
      return `${Math.round(perMove / 3600)}h/move`;
    }
    return "daily";
  }
  const [baseStr, incStr] = tc.split("+");
  const base = Number(baseStr);
  const inc = Number(incStr ?? 0);
  const baseLabel = base % 60 === 0 ? `${base / 60}` : `${base}s`;
  return `${baseLabel}+${Number.isFinite(inc) ? inc : 0}`;
}

function normalizeGame(g: RawChessComGame): ImportedGame {
  const pgn = g.pgn ?? "";
  return {
    id: g.uuid ?? g.url ?? `${g.white?.username}-${g.black?.username}-${g.end_time}`,
    platform: "chesscom",
    white: { username: g.white?.username ?? "White", rating: g.white?.rating ?? null },
    black: { username: g.black?.username ?? "Black", rating: g.black?.rating ?? null },
    result: resultFromChessCom(g.white, g.black),
    timeControl: formatTimeControl(g.time_control),
    timeClass: g.time_class ?? null,
    rated: g.rated ?? false,
    endTime: g.end_time ? g.end_time * 1000 : null,
    pgn,
    url: g.url ?? null,
    opening: pgnHeader(pgn, "Opening") ?? openingFromEcoUrl(pgnHeader(pgn, "ECOUrl")),
    eco: pgnHeader(pgn, "ECO"),
  };
}

function openingFromEcoUrl(url: string | null): string | null {
  if (!url) return null;
  const slug = url.split("/").pop();
  return slug ? slug.replace(/-/g, " ") : null;
}

function pickRating(stats: Record<string, { last?: { rating?: number } }>): number | null {
  for (const key of ["chess_rapid", "chess_blitz", "chess_bullet", "chess_daily"]) {
    const rating = stats?.[key]?.last?.rating;
    if (typeof rating === "number") return rating;
  }
  return null;
}

function normalizeProfile(
  profile: Record<string, unknown>,
  stats: Record<string, { last?: { rating?: number } }>,
): ImportedProfile {
  return {
    platform: "chesscom",
    username: (profile.username as string) ?? "",
    name: (profile.name as string) ?? null,
    title: (profile.title as string) ?? null,
    avatar: (profile.avatar as string) ?? null,
    rating: pickRating(stats),
    url: (profile.url as string) ?? "",
  };
}

export async function loadChessCom(username: string): Promise<ImportResponse> {
  const user = username.toLowerCase();

  const profileRes = await ccFetch(`${BASE}/player/${encodeURIComponent(user)}`);
  if (profileRes.status === 404) {
    throw new ImportError("No Chess.com player found with that username.", 404);
  }
  if (profileRes.status === 429) {
    throw new ImportError("Chess.com is rate-limiting requests. Wait a moment and try again.", 429);
  }
  if (!profileRes.ok) {
    throw new ImportError("Chess.com is unavailable right now. Try again later.", 502);
  }
  const profileJson = (await profileRes.json()) as Record<string, unknown>;

  const [statsRes, archivesRes] = await Promise.all([
    ccFetch(`${BASE}/player/${encodeURIComponent(user)}/stats`),
    ccFetch(`${BASE}/player/${encodeURIComponent(user)}/games/archives`),
  ]);

  const stats = statsRes.ok ? await statsRes.json() : {};
  const archives: string[] = archivesRes.ok ? (await archivesRes.json()).archives ?? [] : [];

  const raw: RawChessComGame[] = [];
  let scanned = 0;
  for (const archiveUrl of [...archives].reverse()) {
    if (scanned >= MAX_ARCHIVES_SCANNED || raw.length >= MAX_GAMES * 2) break;
    scanned += 1;
    const res = await ccFetch(archiveUrl, { cache: "no-store" });
    if (!res.ok) continue;
    const data = await res.json();
    if (Array.isArray(data.games)) raw.push(...data.games);
  }

  const games = raw
    .filter((g) => g.rules === "chess" && typeof g.pgn === "string" && g.pgn.length > 0)
    .sort((a, b) => (b.end_time ?? 0) - (a.end_time ?? 0))
    .slice(0, MAX_GAMES)
    .map(normalizeGame);

  return { profile: normalizeProfile(profileJson, stats), games };
}
