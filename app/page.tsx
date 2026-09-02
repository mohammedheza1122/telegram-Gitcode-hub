"use client";

import JSZip from "jszip";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../lib/supabase";
import { getTelegramUser, getTelegramWebApp, TelegramUser } from "../lib/telegram";

type FileEntry = { id?: number; path: string; content: string };
type Commit = { id: number; message: string; created_at: string; author_id: number };
type Project = { id: number; name: string; description: string | null; default_branch: string };

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
  const [initData, setInitData] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [syncStatus, setSyncStatus] = useState("غير متصل بقاعدة البيانات");
  const [busy, setBusy] = useState(false);
  const supabaseConfigured = Boolean(getSupabaseClient());
  const current = files.find((file) => file.path === selected);
  const fileNames = useMemo(() => [...files].sort((a, b) => a.path.localeCompare(b.path)), [files]);

  useEffect(() => {
    const webApp = getTelegramWebApp();
    if (!webApp) {
      setTelegramStatus("يعمل خارج Telegram");
      return;
    }

    webApp.ready();
    webApp.expand();
    setTelegramUser(getTelegramUser());
    setInitData(webApp.initData);

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
        await initializeWorkspace(webApp.initData);
      })
      .catch((error: Error) => {
        setTelegramStatus("تعذر التحقق من Telegram");
        setSessionError(error.message);
      });
  }, []);

  async function api(path: string, options: RequestInit = {}) {
    if (!initData) throw new Error("جلسة Telegram غير متاحة");
    const headers = new Headers(options.headers);
    headers.set("x-telegram-init-data", initData);
    headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "فشل الاتصال بالخادم");
    return data;
  }

  async function initializeWorkspace(sessionInitData: string) {
    try {
      const response = await fetch("/api/projects", { headers: { "x-telegram-init-data": sessionInitData } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحميل المشاريع");

      let active: Project = data.projects?.[0];
      if (!active) {
        const createResponse = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-telegram-init-data": sessionInitData },
          body: JSON.stringify({ name: "telegram-gitcode-hub", description: "مشروع برمجي من داخل Telegram" }),
        });
        const created = await createResponse.json();
        if (!createResponse.ok) throw new Error(created.error || "تعذر إنشاء المشروع");
        active = created.project;
      }

      setProject(active);
      const [filesData, commitsData] = await Promise.all([
        fetch(`/api/projects/${active.id}/files`, { headers: { "x-telegram-init-data": sessionInitData } }).then((r) => r.json()),
        fetch(`/api/projects/${active.id}/commits`, { headers: { "x-telegram-init-data": sessionInitData } }).then((r) => r.json()),
      ]);
      if (filesData.ok && filesData.files.length) {
        setFiles(filesData.files.map((file: FileEntry) => ({ id: file.id, path: file.path, content: file.content })));
        setSelected(filesData.files[0].path);
      } else if (filesData.ok) {
        setFiles(starterFiles);
      }
      if (commitsData.ok) setCommits(commitsData.commits);
      setSyncStatus("متصل — محفوظ في Supabase");
    } catch (error) {
      setSyncStatus("تعذر المزامنة");
      setSessionError(error instanceof Error ? error.message : "تعذر تحميل مساحة العمل");
    }
  }

  function updateContent(value: string) {
    setFiles((items) => items.map((file) => (file.path === selected ? { ...file, content: value } : file)));
  }

  async function commitChanges() {
    const trimmed = message.trim();
    if (!trimmed || !project || !initData) return;
    setBusy(true);
    setSessionError("");
    try {
      const data = await api(`/api/projects/${project.id}/commits`, {
        method: "POST",
        body: JSON.stringify({ message: trimmed, files: files.map(({ path, content }) => ({ path, content })) }),
      });
      setCommits((items) => [data.commit, ...items]);
      setMessage("");
      setSyncStatus("تم الحفظ وإنشاء Commit");
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "تعذر إنشاء Commit");
    } finally {
      setBusy(false);
    }
  }

  async function importZip(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const zip = await JSZip.loadAsync(file);
      const imported: FileEntry[] = [];
      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir || path.includes("../") || path.startsWith("/")) continue;
        imported.push({ path, content: await entry.async("string") });
      }
      if (imported.length) {
        setFiles(imported);
        setSelected(imported[0].path);
        setSyncStatus("تم استيراد ZIP — لم يُحفظ حتى تعمل Commit");
      }
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "ملف ZIP غير صالح");
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
    anchor.download = `${project?.name ?? "telegram-gitcode-hub"}.zip`;
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
          <span className="badge">{syncStatus}</span>
        </div>
      </header>

      <section className="dashboard">
        <aside className="card sidebar">
          <h2>المستودع</h2>
          <div className="repo">
            <strong>{project?.name ?? "telegram-gitcode-hub"}</strong>
            <span className="muted">{project?.default_branch ?? "main"} · {files.length} ملفات</span>
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
            {commits.length === 0 ? <div className="muted">لا توجد عمليات Commit بعد.</div> : commits.map((commit) => (
              <div className="historyItem" key={commit.id}>
                <div><strong>{commit.message}</strong><div className="muted">{new Date(commit.created_at).toLocaleString("ar")}</div></div>
              </div>
            ))}
          </div>
        </aside>

        <div className="workspace">
          <div className="workspaceTop">
            <div><h1>محرر الملفات</h1><span className="muted">التعديلات تُحفظ في Supabase عند إنشاء Commit.</span></div>
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
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="رسالة الـ Commit..." maxLength={200} />
            <button className="btn primary" onClick={commitChanges} disabled={busy || !message.trim() || !project}> {busy ? "جارٍ الحفظ..." : "Commit"}</button>
          </div>
        </div>
      </section>
    </main>
  );
}
