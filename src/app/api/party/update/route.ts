import { NextResponse } from "next/server";
import { db } from "@/db";
import { partyPlayers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Record<string, unknown>;
    const code = String(b.code || "").slice(0, 6);
    const playerId = String(b.playerId || "");
    if (!code || !playerId) return NextResponse.json({ error: "bad request" }, { status: 400 });
    const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    await db
      .update(partyPlayers)
      .set({
        posX: num(b.x, 0), posY: num(b.y, 1.7), posZ: num(b.z, 0),
        rotY: num(b.rotY, 0), pitch: num(b.pitch, 0),
        health: Math.max(0, Math.min(200, Math.round(num(b.health, 100)))),
        alive: num(b.alive, 1) ? 1 : 0,
        weapon: String(b.weapon || "rifle").slice(0, 32),
        skin: b.skin ? String(b.skin).slice(0, 32) : undefined,
        name: b.name ? String(b.name).slice(0, 24) : undefined,
        score: b.score !== undefined ? Math.round(num(b.score, 0)) : undefined,
        kills: b.kills !== undefined ? Math.round(num(b.kills, 0)) : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(partyPlayers.code, code), eq(partyPlayers.playerId, playerId)));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "update failed" }, { status: 500 });
  }
}
