import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

function validateTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) return null;

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (calculatedHash.length !== receivedHash.length) return null;
  const a = Buffer.from(calculatedHash, "hex");
  const b = Buffer.from(receivedHash, "hex");
  if (a.length !== b.length || !a.equals(b)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || Math.floor(Date.now() / 1000) - authDate > 86400) return null;

  try {
    return JSON.parse(params.get("user") ?? "null");
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { initData?: string } | null;
  if (!body?.initData) {
    return NextResponse.json({ ok: false, error: "initData is required" }, { status: 400 });
  }

  const user = validateTelegramInitData(body.initData, botToken);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Invalid or expired Telegram initData" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, user });
}
