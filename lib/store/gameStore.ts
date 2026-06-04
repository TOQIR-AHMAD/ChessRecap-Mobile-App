import { Chess } from "chess.js";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import type { ImportedGame } from "@/lib/import/types";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** One half-move in a loaded game, with the positions on either side of it. */
export interface ReviewMove {
  ply: number; // 1-based half-move index
  moveNumber: number; // full-move number shown in the move list
  color: "w" | "b";
  san: string;
  uci: string; // long algebraic, e.g. "e2e4", "e7e8q"
  fenBefore: string;
  fenAfter: string;
}

interface GameStore {
  game: ImportedGame | null;
  headers: Record<string, string>;
  moves: ReviewMove[];
  startFen: string;
  /** Current position = the position after `ply` half-moves (0 = start). */
  ply: number;

  loadGame: (game: ImportedGame) => boolean;
  clear: () => void;
  goTo: (ply: number) => void;
  first: () => void;
  prev: () => void;
  next: () => void;
  last: () => void;
}

interface ParsedGame {
  ok: boolean;
  headers: Record<string, string>;
  moves: ReviewMove[];
  startFen: string;
}

function parseGame(pgn: string): ParsedGame {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return { ok: false, headers: {}, moves: [], startFen: START_FEN };
  }

  const headers = chess.getHeaders();
  const verbose = chess.history({ verbose: true });
  const startFen = verbose.length > 0 ? verbose[0].before : headers.FEN ?? START_FEN;

  // Full-move numbering derived from the start position's move counter.
  const startMoveNumber = Number(startFen.split(" ")[5]) || 1;
  const startsBlack = startFen.split(" ")[1] === "b";

  const moves: ReviewMove[] = verbose.map((m, index) => ({
    ply: index + 1,
    moveNumber: startMoveNumber + Math.floor((index + (startsBlack ? 1 : 0)) / 2),
    color: m.color,
    san: m.san,
    uci: m.lan,
    fenBefore: m.before,
    fenAfter: m.after,
  }));

  return { ok: true, headers, moves, startFen };
}

/**
 * No-op storage for the server, where `localStorage` doesn't exist. On the
 * client the real `localStorage` is used so a loaded game (and the move you
 * were on) survives a page refresh of /review.
 */
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      game: null,
      headers: {},
      moves: [],
      startFen: START_FEN,
      ply: 0,

      loadGame: (game) => {
        const parsed = parseGame(game.pgn);
        if (!parsed.ok || parsed.moves.length === 0) return false;
        set({
          game,
          headers: parsed.headers,
          moves: parsed.moves,
          startFen: parsed.startFen,
          ply: 0,
        });
        return true;
      },

      clear: () => set({ game: null, headers: {}, moves: [], startFen: START_FEN, ply: 0 }),

      goTo: (ply) => set({ ply: clamp(ply, 0, get().moves.length) }),
      first: () => set({ ply: 0 }),
      prev: () => set((s) => ({ ply: Math.max(0, s.ply - 1) })),
      next: () => set((s) => ({ ply: Math.min(s.moves.length, s.ply + 1) })),
      last: () => set((s) => ({ ply: s.moves.length })),
    }),
    {
      name: "chessfold:game",
      version: 1,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage,
      ),
      // Persist only the data — the action functions are recreated on load.
      partialize: (s) => ({
        game: s.game,
        headers: s.headers,
        moves: s.moves,
        startFen: s.startFen,
        ply: s.ply,
      }),
    },
  ),
);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** FEN of the currently displayed position. */
export function selectCurrentFen(s: GameStore): string {
  return s.ply === 0 ? s.startFen : s.moves[s.ply - 1].fenAfter;
}

/** The move that produced the current position (for last-move highlighting). */
export function selectCurrentMove(s: GameStore): ReviewMove | null {
  return s.ply === 0 ? null : s.moves[s.ply - 1] ?? null;
}
