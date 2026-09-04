import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_APP_URL = "https://my-project-telegram-gitcode.vercel.app";

export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" },
      { status: 503 }
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");
  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
      cache: "no-store",
    });

    const data = (await response.json()) as { ok?: boolean };

    if (!response.ok || data.ok !== true) {
      return NextResponse.json(
        { ok: false, error: "Telegram rejected the webhook registration" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, webhookRegistered: true });
  } catch (error) {
    console.error("Telegram webhook setup error:", error);
    return NextResponse.json(
      { ok: false, error: "Webhook registration failed" },
      { status: 500 }
    );
  }
}
