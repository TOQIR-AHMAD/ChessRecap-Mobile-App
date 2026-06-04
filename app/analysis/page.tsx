import { AnalysisPlayground } from "@/components/playground/AnalysisPlayground";

export const metadata = {
  title: "Analysis board — ChessFold",
};

export default function AnalysisPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Analysis board</h1>
        <p className="text-sm text-muted-foreground">
          Play any position and get a live Stockfish evaluation.
        </p>
      </section>
      <AnalysisPlayground />
    </div>
  );
}
