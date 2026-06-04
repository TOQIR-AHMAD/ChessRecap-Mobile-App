import { DEFAULT_DEPTH, ENGINE_HASH_MB, ENGINE_PATH } from "./constants";
import type { AnalysisResult, EngineInfo, Score } from "./types";
import { fenTurn, parseBestMove, parseInfoLine } from "./uci";

const ZERO: Score = { type: "cp", value: 0 };

interface AnalyzeOptions {
  depth?: number;
  multiPv?: number;
}

interface Job {
  fen: string;
  depth: number;
  multiPv: number;
  turn: "w" | "b";
  onUpdate?: (info: EngineInfo) => void;
  resolve: (result: AnalysisResult) => void;
  reject: (error: unknown) => void;
  /** Best (multipv 1) line seen so far for this job. */
  best: EngineInfo | null;
  /** Latest line seen for each multipv index (1-based); newest depth wins. */
  lines: Map<number, EngineInfo>;
  cancelled: boolean;
}

/**
 * A thin, promise-based wrapper around the Stockfish Web Worker.
 *
 * All UCI messaging lives here; callers only ever see typed results. Requests
 * are "latest wins": issuing a new analysis cancels any queued one and stops the
 * in-flight search, which keeps an interactive board responsive. Batch callers
 * (Phase 4) simply `await` each call in turn, so nothing is ever dropped.
 */
export class UciEngine {
  private worker: Worker | null = null;
  private ready = false;
  private initPromise: Promise<void> | null = null;
  private onUciOk: (() => void) | null = null;
  private readyResolvers: Array<() => void> = [];
  private queue: Job[] = [];
  private current: Job | null = null;

  /** @param hashMb Transposition-table size; defaults to the interactive size. */
  constructor(private readonly hashMb: number = ENGINE_HASH_MB) {}

  /** Boot the worker, negotiate UCI, and configure options. Idempotent. */
  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      try {
        const worker = new Worker(ENGINE_PATH);
        this.worker = worker;
        worker.onmessage = (event) => this.handleLine(event);
        worker.onerror = (event) =>
          reject(new Error(`Stockfish worker failed: ${event.message}`));

        // uciok -> set options -> isready -> readyok -> engine ready.
        this.onUciOk = () => {
          this.send(`setoption name Hash value ${this.hashMb}`);
          this.readyResolvers.push(() => {
            this.ready = true;
            resolve();
            this.runNext();
          });
          this.send("isready");
        };
        this.send("uci");
      } catch (error) {
        reject(error);
      }
    });

    return this.initPromise;
  }

  get isReady(): boolean {
    return this.ready;
  }

  /**
   * Analyse a position to a fixed depth. `onUpdate` fires on every improved
   * line so the UI can stream the evaluation as it deepens.
   */
  analyze(
    fen: string,
    options?: AnalyzeOptions,
    onUpdate?: (info: EngineInfo) => void,
  ): Promise<AnalysisResult> {
    const depth = options?.depth ?? DEFAULT_DEPTH;
    const multiPv = Math.max(1, options?.multiPv ?? 1);

    return new Promise<AnalysisResult>((resolve, reject) => {
      const job: Job = {
        fen,
        depth,
        multiPv,
        turn: fenTurn(fen),
        onUpdate,
        resolve,
        reject,
        best: null,
        lines: new Map(),
        cancelled: false,
      };

      // Latest wins: discard queued (not-yet-started) jobs.
      for (const queued of this.queue) {
        queued.cancelled = true;
        queued.resolve(cancelledResult(queued.fen));
      }
      this.queue = [job];

      if (this.current) {
        // Stop the running search; runNext() picks up this job when it ends.
        this.send("stop");
      } else {
        this.runNext();
      }
    });
  }

  /** Ask the engine to stop the current search early (resolves at current depth). */
  stop(): void {
    if (this.current) this.send("stop");
  }

  /** Terminate the worker and reset all state. */
  quit(): void {
    if (this.worker) {
      try {
        this.send("quit");
      } catch {
        // ignore — worker may already be gone
      }
      this.worker.terminate();
    }
    this.worker = null;
    this.ready = false;
    this.current = null;
    this.queue = [];
    this.initPromise = null;
  }

  private runNext(): void {
    if (this.current || !this.ready || !this.worker) return;

    let job = this.queue.shift();
    while (job && job.cancelled) job = this.queue.shift();
    if (!job) return;

    this.current = job;
    this.send(`setoption name MultiPV value ${job.multiPv}`);
    this.send(`position fen ${job.fen}`);
    this.send(`go depth ${job.depth}`);
  }

  private finishCurrent(bestMoveLine: string): void {
    const job = this.current;
    if (!job) return;
    this.current = null;

    const best = job.best;
    const lines = [...job.lines.values()].sort((a, b) => a.multipv - b.multipv);
    const result: AnalysisResult = {
      fen: job.fen,
      depth: best?.depth ?? 0,
      evaluation: best?.scoreWhite ?? ZERO,
      evaluationRelative: best?.score ?? ZERO,
      bestMove: parseBestMove(bestMoveLine) ?? best?.pv[0] ?? null,
      pv: best?.pv ?? [],
      lines,
      cancelled: job.cancelled,
    };
    job.resolve(result);
    this.runNext();
  }

  private handleLine(event: MessageEvent): void {
    const data = event.data;
    const line: string =
      typeof data === "string"
        ? data
        : data && typeof data.data === "string"
          ? data.data
          : String(data ?? "");
    if (!line) return;

    if (line === "uciok") {
      const cb = this.onUciOk;
      this.onUciOk = null;
      cb?.();
      return;
    }
    if (line.startsWith("readyok")) {
      this.readyResolvers.shift()?.();
      return;
    }

    const job = this.current;
    if (!job) return;

    if (line.startsWith("info")) {
      const info = parseInfoLine(line, job.turn);
      if (!info) return;
      job.lines.set(info.multipv, info);
      if (info.multipv === 1) {
        job.best = info;
        if (!job.cancelled) job.onUpdate?.(info);
      }
      return;
    }
    if (line.startsWith("bestmove")) {
      this.finishCurrent(line);
    }
  }

  private send(command: string): void {
    this.worker?.postMessage(command);
  }
}

function cancelledResult(fen: string): AnalysisResult {
  return {
    fen,
    depth: 0,
    evaluation: ZERO,
    evaluationRelative: ZERO,
    bestMove: null,
    pv: [],
    lines: [],
    cancelled: true,
  };
}
