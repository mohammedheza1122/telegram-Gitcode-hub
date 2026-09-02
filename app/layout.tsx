import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Telegram GitCode Hub",
  description: "A Telegram-first code repository workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}