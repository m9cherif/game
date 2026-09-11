import { NextResponse } from "next/server";
import { DbNotConfiguredError, isDbConfigured } from "@/db";

/**
 * Handle errors thrown by DB-backed API routes. If the error is because the
 * database isn't configured, return a clean 503 instead of a generic 500 so
 * clients (and uptime monitors) can tell the service is running but waiting
 * on a database.
 */
export function handleApiError(e: unknown, fallbackMessage = "request failed"): NextResponse {
  if (e instanceof DbNotConfiguredError || !isDbConfigured()) {
    return NextResponse.json(
      { error: "database not configured", code: "NO_DATABASE" },
      { status: 503 },
    );
  }
  const message = e instanceof Error ? e.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}
