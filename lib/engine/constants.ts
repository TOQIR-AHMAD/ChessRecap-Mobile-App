/**
 * Engine configuration.
 *
 * We ship the "lite, single-threaded" Stockfish 18 WASM build. It is ~7 MB,
 * runs in any modern browser WITHOUT cross-origin isolation (no SharedArrayBuffer
 * / COOP+COEP headers required), and is still far stronger than any human player.
 * The matching `.wasm` lives next to the loader and is resolved automatically by
 * the loader from its own script name.
 */
export const ENGINE_PATH = "/stockfish/stockfish-18-lite-single.js";

/** Transposition-table size in MiB. Bigger = a little faster, more memory. */
export const ENGINE_HASH_MB = 64;

/** Default search depth for interactive analysis. */
export const DEFAULT_DEPTH = 16;

/** Bounds for user-selectable analysis depth. */
export const MIN_DEPTH = 8;
export const MAX_DEPTH = 22;

/**
 * Depth for the full-game review pass. A little shallower than interactive
 * analysis: every position is searched, so depth trades directly against how
 * long the review takes, and ~12 is plenty to classify human moves.
 */
export const REVIEW_DEPTH = 12;

/**
 * MultiPV for the review pass. Two lines let us see how much better the best
 * move is than the runner-up, which is what distinguishes a forced "only move"
 * (Great) from one of several equally good options.
 */
export const REVIEW_MULTIPV = 2;

/**
 * Smaller transposition table for review workers: positions are searched once
 * and independently, so a big table mostly wastes memory — and we run several
 * of these workers at once.
 */
export const REVIEW_HASH_MB = 16;

/**
 * Upper bound on parallel review workers. The pass spins up this many Stockfish
 * workers (clamped to the machine's core count) and searches positions across
 * them concurrently, which is the bulk of the speed-up over a single worker.
 */
export const REVIEW_MAX_WORKERS = 4;
