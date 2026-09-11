import { NextResponse } from "next/server";

import { db } from "@/db";
import { partyEvents, partyPlayers } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { handleApiError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { code, playerId, type, payload } = (await req.json()) as { code: string; playerId: string; type: string; payload: Record<string, unknown> };
    const c = String(code || "").slice(0, 6);
    if (!c || !playerId) return NextResponse.json({ error: "bad request" }, { status: 400 });

    // Server-authoritative damage: apply HP + kill credit
    if (type === "damage") {
      const to = String(payload?.to || "");
      const dmg = Math.max(1, Math.min(200, Math.round(Number(payload?.dmg) || 0)));
      if (to && dmg > 0) {
        const rows = await db.select().from(partyPlayers).where(and(eq(partyPlayers.code, c), eq(partyPlayers.playerId, to)));
        const victim = rows[0];
        if (victim && victim.alive) {
          const nhp = Math.max(0, (victim.health ?? 100) - dmg);
          const died = nhp <= 0;
          await db.update(partyPlayers).set({
            health: nhp, alive: died ? 0 : 1,
            deaths: died ? (victim.deaths ?? 0) + 1 : victim.deaths,
            updatedAt: new Date(),
          }).where(and(eq(partyPlayers.code, c), eq(partyPlayers.playerId, to)));
          if (died) {
            await db.update(partyPlayers).set({
              kills: sql`${partyPlayers.kills} + 1`,
              score: sql`${partyPlayers.score} + 100`,
              updatedAt: new Date(),
            }).where(and(eq(partyPlayers.code, c), eq(partyPlayers.playerId, String(playerId))));
          }
        }
      }
    }

    await db.insert(partyEvents).values({ code: c, fromId: String(playerId), type: String(type).slice(0, 32), payload: payload ?? {} });
    // prune: keep last 120 events per party
    await db.execute(sql`DELETE FROM party_events WHERE code = ${c} AND id NOT IN (SELECT id FROM party_events WHERE code = ${c} ORDER BY id DESC LIMIT 120)`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e, "event failed");
  }
}
