import { NextResponse } from "next/server";
import { validateTelegramInitData, ValidatedTelegramUser } from "./telegram-server";
import { getSupabaseAdmin } from "./supabase-admin";

export async function authenticateTelegram(request: Request): Promise<
  | { user: ValidatedTelegramUser; dbUserId: number; admin: NonNullable<ReturnType<typeof getSupabaseAdmin>> }
  | { response: NextResponse }
> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const admin = getSupabaseAdmin();
  if (!botToken || !admin) {
    return { response: NextResponse.json({ ok: false, error: "Server integrations are not configured" }, { status: 503 }) };
  }

  const initData = request.headers.get("x-telegram-init-data") ?? "";
  const user = validateTelegramInitData(initData, botToken);
  if (!user) {
    return { response: NextResponse.json({ ok: false, error: "Invalid or expired Telegram session" }, { status: 401 }) };
  }

  const { data: dbUser, error } = await admin
    .from("users")
    .upsert(
      {
        telegram_user_id: user.id,
        username: user.username ?? null,
        first_name: user.first_name,
        last_name: user.last_name ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "telegram_user_id" },
    )
    .select("id")
    .single();

  if (error || !dbUser) {
    console.error("Telegram user upsert failed", error);
    return { response: NextResponse.json({ ok: false, error: "Unable to initialize user" }, { status: 500 }) };
  }

  return { user, dbUserId: dbUser.id as number, admin };
}
