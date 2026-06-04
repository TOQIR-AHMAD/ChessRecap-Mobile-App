"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ImportedProfile } from "@/lib/import/types";

export function ProfileCard({ profile }: { profile: ImportedProfile }) {
  const initials = profile.username.slice(0, 2).toUpperCase();
  const platformLabel = profile.platform === "chesscom" ? "Chess.com" : "Lichess";

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <Avatar className="size-12">
        {profile.avatar && <AvatarImage src={profile.avatar} alt={profile.username} />}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {profile.title && <Badge variant="secondary">{profile.title}</Badge>}
          <a
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-semibold hover:underline"
          >
            {profile.username}
          </a>
        </div>
        {profile.name && <p className="truncate text-sm text-muted-foreground">{profile.name}</p>}
      </div>
      <div className="text-right">
        <p className="font-mono text-lg font-semibold">{profile.rating ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{platformLabel}</p>
      </div>
    </div>
  );
}
