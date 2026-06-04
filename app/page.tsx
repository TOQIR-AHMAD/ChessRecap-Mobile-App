import { ImportPanel } from "@/components/import/ImportPanel";
import { PlayBoard } from "@/components/playground/PlayBoard";

export default function HomePage() {
  return (
    <div className="grid w-full gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Review one of your games</h1>
          <p className="text-sm text-muted-foreground">
            Pull your recent games from Chess.com or Lichess, or paste a PGN.
          </p>
        </div>
        <ImportPanel className="flex-1" />
      </section>

      <section className="flex flex-col gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Play it out</h2>
          <p className="text-sm text-muted-foreground">
            Make moves on the board — legal moves are highlighted.
          </p>
        </div>
        <PlayBoard className="flex-1" />
      </section>
    </div>
  );
}
