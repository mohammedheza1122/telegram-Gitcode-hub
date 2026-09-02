import { createHmac } from "node:crypto";

export type ValidatedTelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export function validateTelegramInitData(initData: string, botToken: string): ValidatedTelegramUser | null {
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

  const calculated = Buffer.from(calculatedHash, "hex");
  const received = Buffer.from(receivedHash, "hex");
  if (calculated.length !== received.length || !calculated.equals(received)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || Math.floor(Date.now() / 1000) - authDate > 86400) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "null") as ValidatedTelegramUser | null;
    return user?.id && user.first_name ? user : null;
  } catch {
    return null;
  }
}
