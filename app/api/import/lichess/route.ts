import { NextResponse, type NextRequest } from "next/server";

import { loadLichess } from "@/lib/import/lichess";
import { getCached, getClientId, rateLimit, setCached } from "@/lib/import/server-cache";
import { ImportError, isValidUsername } from "@/lib/import/shared";

export const runtime = "nodejs";

const CACHE_HEADERS = { "Cache-Control": "public, max-age=300" };

export async function GET(request: NextRequest) {
  const limit = rateLimit(getClientId(request));
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const username = (request.nextUrl.searchParams.get("username") ?? "").trim();
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: "Please enter a valid Lichess username." }, { status: 400 });
  }

  const cacheKey = `lichess:${username.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: { ...CACHE_HEADERS, "X-Cache": "HIT" } });
  }

  try {
    const data = await loadLichess(username);
    setCached(cacheKey, data);
    return NextResponse.json(data, { headers: { ...CACHE_HEADERS, "X-Cache": "MISS" } });
  } catch (error) {
    if (error instanceof ImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Something went wrong importing games from Lichess." },
      { status: 500 },
    );
  }
}
