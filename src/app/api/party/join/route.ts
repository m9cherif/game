import { NextResponse } from "next/server";

import { db } from "@/db";
import { parties, partyPlayers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { handleApiError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { code, name, playerId } = (await req.json()) as { code: string; name: string; playerId: string };
    const c = String(code || "").replace(/\D/g, "").slice(0, 6);
    if (c.length !== 6) return NextResponse.json({ error: "Enter a 6-digit code" }, { status: 400 });
    const rows = await db.select().from(parties).where(eq(parties.code, c));
    const party = rows[0];
    if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });
    const existing = await db.select().from(partyPlayers).where(and(eq(partyPlayers.code, c), eq(partyPlayers.playerId, String(playerId))));
    const all = await db.select().from(partyPlayers).where(eq(partyPlayers.code, c));
    if (!existing.length && all.length >= (party.maxPlayers ?? 6)) return NextResponse.json({ error: "Party is full" }, { status: 400 });
    const nm = String(name || "ACE").slice(0, 24);
    if (existing.length) {
      await db.update(partyPlayers).set({ name: nm, updatedAt: new Date() }).where(and(eq(partyPlayers.code, c), eq(partyPlayers.playerId, String(playerId))));
    } else {
      const i = all.length % 8;
      const a = (i / 8) * Math.PI * 2;
      await db.insert(partyPlayers).values({
        code: c, playerId: String(playerId), name: nm, skin: "cyan", weapon: "rifle",
        posX: Math.cos(a) * 24, posY: 1.7, posZ: Math.sin(a) * 24, rotY: a + Math.PI, health: 100,
      });
    }
    return NextResponse.json({ ok: true, playerId, party });
  } catch (e) {
    return handleApiError(e, "join failed");
  }
}
