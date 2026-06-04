"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatGameDate, winnerOf } from "@/lib/import/format";
import type { ImportedGame, ImportedPlayer } from "@/lib/import/types";
import { cn } from "@/lib/utils";

type SortKey = "white" | "black" | "result" | "time" | "date";
type SortDir = "asc" | "desc";

const PAGE_SIZES = [10, 20, 30];

interface GameTableProps {
  games: ImportedGame[];
  onSelect: (game: ImportedGame) => void;
  loadingId?: string | null;
}

export function GameTable({ games, onSelect, loadingId }: GameTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);

  // Reset to the first page whenever the data set or sorting changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setPage(0), [games, sortKey, sortDir, pageSize]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...games].sort((a, b) => dir * compareGames(a, b, sortKey));
  }, [games, sortKey, sortDir]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const pageGames = sorted.slice(start, start + pageSize);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortHeader label="White" col="white" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Black" col="black" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Result" col="result" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader
                label="Time"
                col="time"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden md:table-cell"
              />
              <SortHeader
                label="Date"
                col="date"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden sm:table-cell"
              />
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {pageGames.map((game) => {
              const winner = winnerOf(game.result);
              const isLoading = loadingId === game.id;
              return (
                <tr
                  key={game.id}
                  onClick={() => !loadingId && onSelect(game)}
                  className={cn(
                    "border-t transition-colors",
                    loadingId ? "cursor-default opacity-70" : "cursor-pointer hover:bg-accent",
                  )}
                >
                  <PlayerCell player={game.white} side="white" isWinner={winner === "white"} />
                  <PlayerCell player={game.black} side="black" isWinner={winner === "black"} />
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="font-mono">
                      {game.result}
                    </Badge>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2 text-muted-foreground md:table-cell">
                    {game.timeControl}
                    {game.timeClass ? ` · ${game.timeClass}` : ""}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2 text-muted-foreground sm:table-cell">
                    {formatGameDate(game.endTime)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isLoading ? (
                      <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-xs text-muted-foreground">
          {total === 0
            ? "No games"
            : `Showing ${start + 1}–${Math.min(start + pageSize, total)} of ${total}`}
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Rows
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border bg-background px-1.5 py-1 text-foreground"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs text-muted-foreground">
            Page {safePage + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <PageButton onClick={() => setPage(0)} disabled={safePage === 0} label="First page">
              <ChevronsLeft className="size-4" />
            </PageButton>
            <PageButton
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </PageButton>
            <PageButton
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              label="Next page"
            >
              <ChevronRight className="size-4" />
            </PageButton>
            <PageButton
              onClick={() => setPage(totalPages - 1)}
              disabled={safePage >= totalPages - 1}
              label="Last page"
            >
              <ChevronsRight className="size-4" />
            </PageButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === col;
  const Icon = !active ? ChevronsUpDown : sortDir === "asc" ? ChevronUp : ChevronDown;
  return (
    <th className={cn("px-3 py-2 text-left font-medium", className)}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className="size-3.5" />
      </button>
    </th>
  );
}

function PlayerCell({
  player,
  side,
  isWinner,
}: {
  player: ImportedPlayer;
  side: "white" | "black";
  isWinner: boolean;
}) {
  return (
    <td className="max-w-[12rem] px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-block size-2.5 shrink-0 rounded-full border",
            side === "white" ? "bg-neutral-100" : "bg-neutral-800",
          )}
          aria-hidden
        />
        <span className={cn("truncate", isWinner && "font-semibold")}>{player.username}</span>
        {player.rating != null && (
          <span className="shrink-0 text-xs text-muted-foreground">({player.rating})</span>
        )}
      </div>
    </td>
  );
}

function PageButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

function compareGames(a: ImportedGame, b: ImportedGame, key: SortKey): number {
  switch (key) {
    case "white":
      return (a.white.rating ?? 0) - (b.white.rating ?? 0);
    case "black":
      return (a.black.rating ?? 0) - (b.black.rating ?? 0);
    case "result":
      return a.result.localeCompare(b.result);
    case "time":
      return a.timeControl.localeCompare(b.timeControl, undefined, { numeric: true });
    case "date":
      return (a.endTime ?? 0) - (b.endTime ?? 0);
  }
}
