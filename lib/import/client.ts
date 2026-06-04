"use client";

import { Capacitor } from "@capacitor/core";

import { loadChessCom } from "./chesscom";
import { loadLichess } from "./lichess";
import { ImportError } from "./shared";
import type { ImportResponse } from "./types";

type Site = "chesscom" | "lichess";

/**
 * Fetch a player's recent games + profile, choosing the transport per platform.
 *
 * On native (Capacitor) we call the Chess.com / Lichess APIs directly: the
 * CapacitorHttp plugin routes fetch() through native networking, which can set a
 * User-Agent (browsers forbid this) and ignores CORS — so the app ships without
 * a backend. In a regular browser we still go through the Next.js route handler,
 * for exactly those two reasons.
 *
 * Both paths resolve to an {@link ImportResponse} or throw an {@link ImportError}.
 */
export async function importAccount(site: Site, username: string): Promise<ImportResponse> {
  if (Capacitor.isNativePlatform()) {
    return site === "chesscom" ? loadChessCom(username) : loadLichess(username);
  }

  const res = await fetch(`/api/import/${site}?username=${encodeURIComponent(username)}`);
  const data = (await res.json()) as ImportResponse & { error?: string };
  if (!res.ok) {
    throw new ImportError(data.error ?? "Could not load games. Please try again.", res.status);
  }
  return data;
}
