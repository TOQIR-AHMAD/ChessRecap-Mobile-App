"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileText, Loader2, Upload } from "lucide-react";

import { GameTable } from "./GameTable";
import { ProfileCard } from "./ProfileCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { importAccount } from "@/lib/import/client";
import { parsePgnGames } from "@/lib/import/pgn";
import { ImportError } from "@/lib/import/shared";
import type { ImportedGame, ImportedProfile } from "@/lib/import/types";
import { useGameStore } from "@/lib/store/gameStore";
import { cn } from "@/lib/utils";

type Platform = "chesscom" | "lichess" | "pgn";

const PLATFORMS: {
  id: Platform;
  label: string;
  glyph: string;
  glyphClass: string;
  icon?: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "chesscom", label: "Chess.com", glyph: "♟", glyphClass: "text-emerald-400" },
  { id: "lichess", label: "Lichess.org", glyph: "♞", glyphClass: "text-neutral-200" },
  { id: "pgn", label: "PGN", glyph: "", glyphClass: "", icon: FileText },
];

const EXAMPLES: Record<"chesscom" | "lichess", { label: string; username: string }[]> = {
  chesscom: [
    { label: "Magnus Carlsen", username: "MagnusCarlsen" },
    { label: "Hikaru", username: "Hikaru" },
    { label: "GothamChess", username: "GothamChess" },
  ],
  lichess: [
    { label: "Magnus Carlsen", username: "DrNykterstein" },
    { label: "penguingm1", username: "penguingm1" },
    { label: "Zhigalko_Sergei", username: "Zhigalko_Sergei" },
  ],
};

const RECENT_KEY = "chessfold:recent-import";

export function ImportPanel({ className }: { className?: string }) {
  const router = useRouter();
  const loadGame = useGameStore((s) => s.loadGame);

  const [platform, setPlatform] = useState<Platform>("chesscom");
  const [username, setUsername] = useState("");
  const [pgnText, setPgnText] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ImportedProfile | null>(null);
  const [games, setGames] = useState<ImportedGame[]>([]);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [recent, setRecent] = useState<{ platform: Platform; username: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      // ignore malformed storage
    }
  }, []);

  const resetResults = useCallback(() => {
    setError(null);
    setProfile(null);
    setGames([]);
  }, []);

  const fetchAccount = useCallback(
    async (target: "chesscom" | "lichess", user: string) => {
      const trimmed = user.trim();
      if (!trimmed) {
        setError("Enter a username first.");
        return;
      }
      resetResults();
      setLoading(true);
      try {
        const data = await importAccount(target, trimmed);
        setProfile(data.profile ?? null);
        setGames(data.games ?? []);
        if ((data.games ?? []).length === 0) {
          setError("No recent standard games found for this account.");
        } else {
          const entry = { platform: target, username: trimmed };
          setRecent(entry);
          try {
            localStorage.setItem(RECENT_KEY, JSON.stringify(entry));
          } catch {
            // ignore storage failures
          }
        }
      } catch (err) {
        setError(
          err instanceof ImportError
            ? err.message
            : "Network error — check your connection and try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [resetResults],
  );

  const loadPgnText = useCallback(
    (text: string) => {
      resetResults();
      const parsed = parsePgnGames(text);
      if (parsed.length === 0) {
        setError("No valid games found in that PGN.");
        return;
      }
      setGames(parsed);
    },
    [resetResults],
  );

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const text = await file.text();
      setPgnText(text);
      loadPgnText(text);
    },
    [loadPgnText],
  );

  const onSelectGame = useCallback(
    (game: ImportedGame) => {
      setSelectingId(game.id);
      if (!loadGame(game)) {
        setSelectingId(null);
        setError("That game's PGN could not be parsed.");
        return;
      }
      router.push("/review");
    },
    [loadGame, router],
  );

  const useRecent = useCallback(() => {
    if (!recent) return;
    if (recent.platform === "pgn") return;
    setPlatform(recent.platform);
    setUsername(recent.username);
    void fetchAccount(recent.platform, recent.username);
  }, [recent, fetchAccount]);

  return (
    <div className={cn("space-y-5 rounded-2xl border bg-card p-4 sm:p-6", className)}>
      {/* Platform tiles */}
      <div className="grid grid-cols-3 gap-3">
        {PLATFORMS.map((p) => {
          const active = platform === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPlatform(p.id);
                resetResults();
              }}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-5 transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-muted-foreground/30 hover:bg-accent",
              )}
            >
              {active && (
                <span className="absolute right-2 top-2 size-2 rounded-full bg-primary" />
              )}
              {p.icon ? (
                <p.icon className={cn("size-7", active ? "text-primary" : "text-muted-foreground")} />
              ) : (
                <span className={cn("text-3xl leading-none", p.glyphClass)}>{p.glyph}</span>
              )}
              <span className={cn("text-sm font-medium", active ? "text-primary" : "text-foreground")}>
                {p.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Input area */}
      {platform === "pgn" ? (
        <div className="space-y-3">
          <Label htmlFor="pgn">Paste PGN</Label>
          <Textarea
            id="pgn"
            value={pgnText}
            onChange={(e) => setPgnText(e.target.value)}
            placeholder={'[Event "..."]\n1. e4 e5 2. Nf3 Nc6 ...'}
            className="min-h-36 font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => loadPgnText(pgnText)} disabled={!pgnText.trim()} className="flex-1">
              Load PGN
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pgn,application/x-chess-pgn,text/plain"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" />
              Upload .pgn
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void fetchAccount(platform, username);
          }}
        >
          <div className="flex items-center justify-between">
            <Label htmlFor="username">
              {platform === "chesscom" ? "Chess.com" : "Lichess"} username
            </Label>
            {recent && recent.platform === platform && (
              <button
                type="button"
                onClick={useRecent}
                className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Recently used: {recent.username}
              </button>
            )}
          </div>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={platform === "chesscom" ? "e.g. MagnusCarlsen" : "e.g. DrNykterstein"}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="h-11"
          />
          <Button type="submit" disabled={loading} className="h-11 w-full text-base font-semibold">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Fetch recent games"}
          </Button>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-sm text-muted-foreground">Try it out:</span>
            {EXAMPLES[platform].map((ex) => (
              <button
                key={ex.username}
                type="button"
                onClick={() => {
                  setUsername(ex.username);
                  void fetchAccount(platform, ex.username);
                }}
                className="rounded-full border bg-background px-3 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </form>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Couldn&apos;t import</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <LoadingState />}

      {profile && <ProfileCard profile={profile} />}

      {games.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {games.length} game{games.length === 1 ? "" : "s"} — select one to analyse.
          </p>
          <GameTable games={games} onSelect={onSelectGame} loadingId={selectingId} />
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-16 w-full" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
