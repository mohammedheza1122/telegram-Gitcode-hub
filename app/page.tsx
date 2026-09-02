"use client";

import JSZip from "jszip";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../lib/supabase";
import { getTelegramUser, getTelegramWebApp, TelegramUser } from "../lib/telegram";

type FileEntry = { path: string; content: string };
type Commit = { message: string; date: string; files: number };

const starterFiles: FileEntry[] = [
  { path: "README.md", content: "# Telegram GitCode Hub\n\nمشروع برمجي يعمل من داخل Telegram Mini App.\n" },
  { path: "src/index.ts", content: "export const hello = () => 'Hello from Telegram GitCode Hub';\n" },
];

export default function Home() {
  const [files, setFiles] = useState<FileEntry[]>(starterFiles);
  const [selected, setSelected] = useState("README.md");
  const [message, setMessage] = useState("");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [telegramStatus, setTelegramStatus] = useState("جاري التحقق...");
  const [sessionError, setSessionError] = useState("");
  const current = files.find((file) => file.path === selected);
  const fileNames = useMemo(() => [...files].sort((a, b) => a.path.localeCompare(b.path)), [files]);
  const supabaseConfigured = Boolean(getSupabaseClient());

  useEffect(() => {
    const webApp = getTelegramWebApp();
    if (!webApp) {
      setTelegramStatus("يعمل خارج Telegram");
      return;
    }

    webApp.ready();
    webApp.expand();
    setTelegramUser(getTelegramUser());

    if (!webApp.initData) {
      setTelegramStatus("Telegram موجود لكن بيانات الجلسة غير متاحة");
      return;
    }

    fetch("/api/telegram/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: webApp.initData }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "فشل التحقق");
        setTelegramUser(data.user);
        setTelegramStatus("تم التحقق من Telegram");
      })
      .catch((error: Error) => {
        setTelegramStatus("تعذر التحقق من Telegram");
        setSessionError(error.message);
      });
  }, []);

  function updateContent(value: string) {
    setFiles((items) => items.map((file) => (file.path === selected ? { ...file, content: value } : file)));
  }

  function commitChanges() {
    const trimmed = message.trim();
    if (!trimmed) return;
    setCommits((items) => [{ message: trimmed, date: new Date().toLocaleString("ar"), files: files.length }, ...items]);
    setMessage("");
  }

  async function importZip(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const zip = await JSZip.loadAsync(file);
      const imported: FileEntry[] = [];
      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir || path.includes("../")) continue;
        imported.push({ path, content: await entry.async("string") });
      }
      if (imported.length) {
        setFiles(imported);
        setSelected(imported[0].path);
      }
    } finally {
      event.target.value = "";
    }
  }

  async function downloadZip() {
    const zip = new JSZip();
    files.forEach((file) => zip.file(file.path, file.content));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "telegram-gitcode-hub.zip";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="shell">
      <header className="header">
        <div className="brand">
          <div className="logo">TG</div>
          <div>
            <strong>Telegram GitCode Hub</strong>
            <div className="muted">مستودعك البرمجي من داخل تيليجرام</div>
          </div>
        </div>
        <div className="statusRow">
          <span className="badge">Telegram: {telegramStatus}</span>
          <span className="badge">Supabase: {supabaseConfigured ? "مهيأ" : "بانتظار الإعداد"}</span>
        </div>
      </header>

      <section className="dashboard">
        <aside className="card sidebar">
          <h2>المستودع</h2>
          <div className="repo">
            <strong>telegram-gitcode-hub</strong>
            <span className="muted">main · {files.length} ملفات</span>
          </div>
          {telegramUser && (
            <div className="userBox">
              <strong>{telegramUser.first_name}{telegramUser.last_name ? ` ${telegramUser.last_name}` : ""}</strong>
              <div className="muted">{telegramUser.username ? `@${telegramUser.username}` : `Telegram ID: ${telegramUser.id}`}</div>
            </div>
          )}
          {sessionError && <div className="errorBox">{sessionError}</div>}
          <div className="actions">
            <label className="btn primary">رفع ZIP<input hidden type="file" accept=".zip,application/zip" onChange={importZip} /></label>
            <button className="btn" onClick={downloadZip}>تنزيل ZIP</button>
          </div>
          <div className="history">
            <h2>سجل الإصدارات</h2>
            {commits.length === 0 ? <div className="muted">لا توجد عمليات Commit بعد.</div> : commits.map((commit, index) => (
              <div className="historyItem" key={`${commit.date}-${index}`}>
                <div><strong>{commit.message}</strong><div className="muted">{commit.date}</div></div>
                <span className="muted">{commit.files}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="workspace">
          <div className="workspaceTop">
            <div><h1>محرر الملفات</h1><span className="muted">رفع، استعراض، تعديل، Commit وتنزيل — تمهيدًا للحفظ في Supabase.</span></div>
          </div>
          <div className="card editorGrid">
            <nav className="tree">
              <div className="treeTitle">FILES</div>
              {fileNames.map((file) => (
                <button key={file.path} className={`file ${selected === file.path ? "active" : ""}`} onClick={() => setSelected(file.path)}>{file.path}</button>
              ))}
            </nav>
            <section className="editor">
              <div className="editorHead">{selected}</div>
              {current ? <textarea value={current.content} onChange={(event) => updateContent(event.target.value)} spellCheck={false} /> : <div className="empty">اختر ملفًا من الشجرة.</div>}
            </section>
          </div>
          <div className="commitBox">
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="رسالة الـ Commit..." />
            <button className="btn primary" onClick={commitChanges} disabled={!message.trim()}>Commit</button>
          </div>
        </div>
      </section>
    </main>
  );
}
