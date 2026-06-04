export type Platform = "chesscom" | "lichess" | "pgn";
export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";

export interface ImportedPlayer {
  username: string;
  rating: number | null;
}

/** A game normalised across Chess.com, Lichess, and pasted PGN. */
export interface ImportedGame {
  id: string;
  platform: Platform;
  white: ImportedPlayer;
  black: ImportedPlayer;
  result: GameResult;
  /** Human-readable time control, e.g. "10+0", "3+2", "1d/move". */
  timeControl: string;
  /** rapid | blitz | bullet | daily | classical | correspondence | null. */
  timeClass: string | null;
  rated: boolean;
  /** Game end time in ms since epoch, or null if unknown. */
  endTime: number | null;
  pgn: string;
  url: string | null;
  opening: string | null;
  eco: string | null;
}

export interface ImportedProfile {
  platform: "chesscom" | "lichess";
  username: string;
  name: string | null;
  title: string | null;
  avatar: string | null;
  rating: number | null;
  url: string;
}

export interface ImportResponse {
  profile: ImportedProfile | null;
  games: ImportedGame[];
}
