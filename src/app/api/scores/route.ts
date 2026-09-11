import { NextResponse } from "next/server";
import { db } from "@/db";
import { highScores } from "@/db/schema";
import { desc } from "drizzle-orm";
import { handleApiError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(highScores).orderBy(desc(highScores.score)).limit(10);
    return NextResponse.json({ scores: rows });
  } catch (e) {
    const err = handleApiError(e, "failed");
    // Always include `scores` so clients don't crash on shape mismatch
    const body = (await err.json()) as Record<string, unknown>;
    return NextResponse.json({ ...body, scores: [] }, { status: err.status });
  }
}

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { name: string; mode: string; score: number; kills: number; wave: number; accuracy: number };
    await db.insert(highScores).values({
      name: String(b.name || "ACE").slice(0, 24),
      mode: String(b.mode || "SKIRMISH").slice(0, 32),
      score: Math.max(0, Math.round(Number(b.score) || 0)),
      kills: Math.max(0, Math.round(Number(b.kills) || 0)),
      wave: Math.max(0, Math.round(Number(b.wave) || 0)),
      accuracy: Math.max(0, Math.min(1, Number(b.accuracy) || 0)),
    });
    const rows = await db.select().from(highScores).orderBy(desc(highScores.score)).limit(10);
    return NextResponse.json({ scores: rows });
  } catch (e) {
    return handleApiError(e, "failed");
  }
}
