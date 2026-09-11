import { NextResponse } from "next/server";
import { db } from "@/db";
import { parties, partyPlayers, partyEvents } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { code, playerId } = (await req.json()) as { code: string; playerId: string };
    const c = String(code || "").slice(0, 6);
    await db.delete(partyPlayers).where(and(eq(partyPlayers.code, c), eq(partyPlayers.playerId, String(playerId))));
    const left = await db.select().from(partyPlayers).where(eq(partyPlayers.code, c));
    if (!left.length) {
      await db.delete(partyEvents).where(eq(partyEvents.code, c));
      await db.delete(parties).where(eq(parties.code, c));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "leave failed" }, { status: 500 });
  }
}
