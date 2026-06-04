import { GameReviewBoard } from "@/components/review/GameReviewBoard";

export const metadata = {
  title: "Review — ChessFold",
};

export default function ReviewPage() {
  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Game review</h1>
        <p className="text-sm text-muted-foreground">
          Step through the game with live engine evaluation.
        </p>
      </section>
      <GameReviewBoard />
    </div>
  );
}
