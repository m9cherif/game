import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { ok: false, status: "no-database", message: "DATABASE_URL is not configured" },
      { status: 503 },
    );
  }
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { ok: false, status: "db-unavailable" },
        { status: 503 },
      );
    }
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, status: "ok" });
  } catch {
    return NextResponse.json(
      { ok: false, status: "db-connection-failed" },
      { status: 503 },
    );
  }
}
