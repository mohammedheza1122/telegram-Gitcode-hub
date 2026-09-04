import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface TelegramUpdate {
  update_id?: number;
  message?: {
    chat?: { id?: number | string };
    text?: string;
    from?: { first_name?: string };
  };
}

async function sendTelegramMessage(chatId: number | string, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Telegram API returned ${response.status}`);
  }
}

export async function POST(request: Request) {
  try {
    const update = (await request.json()) as TelegramUpdate;
    const message = update.message;
    const chatId = message?.chat?.id;

    if (chatId === undefined || chatId === null) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const text = message.text?.trim() ?? "";
    const firstName = message.from?.first_name?.trim() || "صديقي";

    if (text === "/start" || text.startsWith("/start ")) {
      await sendTelegramMessage(
        chatId,
        `مرحبًا ${firstName}! 👋\n\nأهلًا بك في Telegram GitCode Hub.\nسنبدأ تجهيز مساحة العمل الخاصة بك قريبًا.`
      );
    } else if (text === "/help") {
      await sendTelegramMessage(
        chatId,
        "Telegram GitCode Hub\n\n/start — بدء استخدام البوت\n/help — عرض المساعدة"
      );
    } else if (text) {
      await sendTelegramMessage(
        chatId,
        "وصلت رسالتك ✅\nاستخدم /start للبدء أو /help للمساعدة."
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: false, error: "Webhook processing failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "telegram-webhook" });
}
