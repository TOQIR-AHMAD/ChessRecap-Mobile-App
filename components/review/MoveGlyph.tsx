import { MOVE_CLASS_META, type MoveClass } from "@/lib/review/classification";
import { cn } from "@/lib/utils";

interface MoveGlyphProps {
  cls: MoveClass;
  /** Pixel size of the badge. Defaults to 16 (move-list size). */
  size?: number;
  className?: string;
  /** Add a native tooltip with the label + description. */
  withTitle?: boolean;
}

/**
 * A small coloured badge carrying a move's classification glyph (e.g. "!!" for
 * Brilliant). Used inline in the move list and, larger, as an overlay on the
 * board square the move landed on.
 */
export function MoveGlyph({ cls, size = 16, className, withTitle }: MoveGlyphProps) {
  const meta = MOVE_CLASS_META[cls];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: meta.color,
        color: meta.fg,
        fontSize: Math.round(size * 0.58),
      }}
      title={withTitle ? `${meta.label} — ${meta.description}` : undefined}
      aria-label={meta.label}
    >
      {meta.symbol}
    </span>
  );
}
