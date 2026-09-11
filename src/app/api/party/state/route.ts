import { NextResponse } from "next/server";
import { db } from "@/db";
import { parties, partyPlayers, partyEvents } from "@/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { handleApiError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = String(url.searchParams.get("code") || "").slice(0, 6);
    const since = Number(url.searchParams.get("since") || 0);
    if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
    const rows = await db.select().from(parties).where(eq(parties.code, code));
    const party = rows[0];
    if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });
    const players = await db.select().from(partyPlayers).where(eq(partyPlayers.code, code));
    const events = await db
      .select()
      .from(partyEvents)
      .where(and(eq(partyEvents.code, code), gt(partyEvents.id, since)))
      .orderBy(desc(partyEvents.id))
      .limit(30);
    return NextResponse.json({ party, players, events: events.reverse() });
  } catch (e) {
    return handleApiError(e, "state failed");
  }
}
