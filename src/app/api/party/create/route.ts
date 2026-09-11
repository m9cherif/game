import { NextResponse } from "next/server";
import { db } from "@/db";
import { parties, partyPlayers } from "@/db/schema";

export async function POST(req: Request) {
  try {
    const { hostName, mode, arena, playerId } = (await req.json()) as { hostName: string; mode: string; arena: string; playerId: string };
    const name = String(hostName || "HOST").slice(0, 24);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await db.insert(parties).values({
      code,
      hostName: name,
      hostId: String(playerId || "host"),
      mode: String(mode || "SKIRMISH").slice(0, 32),
      arena: String(arena || "NEON_VOID").slice(0, 32),
      status: "lobby",
    });
    await db.insert(partyPlayers).values({
      code, playerId: String(playerId || "host"), name, skin: "cyan", weapon: "rifle",
      posX: 0, posY: 1.7, posZ: 20, rotY: 0, health: 100,
    });
    return NextResponse.json({ code, playerId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "create failed" }, { status: 500 });
  }
}
