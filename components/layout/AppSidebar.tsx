"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Info, ScrollText, Sparkles, SquareDashedMousePointer, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/analysis", label: "Analysis board", icon: SquareDashedMousePointer },
  { href: "/review", label: "Game review", icon: ScrollText },
];

const SOON: { label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "Tools", icon: Wrench },
  { label: "About", icon: Info },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-lg leading-none text-primary">
        ♜
      </span>
      <span className="text-lg font-semibold tracking-tight">ChessFold</span>
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-16 items-center border-b px-4">
        <Brand />
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}

        <div className="mt-3 space-y-1 border-t pt-3">
          {SOON.map((item) => (
            <div
              key={item.label}
              className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/60"
            >
              <item.icon className="size-4" />
              {item.label}
              <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            </div>
          ))}
        </div>
      </nav>

      <div className="space-y-3 border-t p-3">
        <button
          type="button"
          disabled
          className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm font-medium text-muted-foreground"
        >
          <Sparkles className="size-4" />
          Sign in
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">Soon</span>
        </button>
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          Free &amp; unlimited — the engine runs in your browser.
        </p>
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Brand />
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
