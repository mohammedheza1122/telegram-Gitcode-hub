import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasTelegramBotToken = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const admin = getSupabaseAdmin();

  if (!admin) {
    return NextResponse.json(
      { ok: false, status: "not_configured", telegram: hasTelegramBotToken ? "configured" : "missing", supabase: "missing" },
      { status: 503 },
    );
  }

  const { error } = await admin.from("users").select("id").limit(1);
  if (error) {
    console.error("Supabase health check failed", error);
    return NextResponse.json(
      { ok: false, status: "database_error", telegram: hasTelegramBotToken ? "configured" : "missing", supabase: "unreachable" },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, status: "ready", telegram: hasTelegramBotToken ? "configured" : "missing", supabase: "connected" });
}
