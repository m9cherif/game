import { NextResponse } from "next/server";

import { db } from "@/db";
import { parties, partyPlayers, partyEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { code, playerId } = (await req.json()) as { code: string; playerId: string };
    const c = String(code || "").slice(0, 6);
    const rows = await db.select().from(parties).where(eq(parties.code, c));
    const party = rows[0];
    if (!party) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (party.hostId !== String(playerId)) return NextResponse.json({ error: "only host can start" }, { status: 403 });
    await db.update(parties).set({ status: "playing", startedAt: new Date() }).where(eq(parties.code, c));
    // reset all players
    await db.update(partyPlayers).set({ health: 100, alive: 1, score: 0, kills: 0, deaths: 0 }).where(eq(partyPlayers.code, c));
    await db.insert(partyEvents).values({ code: c, fromId: String(playerId), type: "start", payload: { at: Date.now() } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e, "start failed");
  }
}
