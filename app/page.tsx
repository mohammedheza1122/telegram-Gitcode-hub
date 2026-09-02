"use client";

import JSZip from "jszip";
import { ChangeEvent, useMemo, useState } from "react";

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
  const current = files.find((file) => file.path === selected);

  const fileNames = useMemo(() => [...files].sort((a, b) => a.path.localeCompare(b.path)), [files]);

  function updateContent(value: string) {
    setFiles((items) => items.map((file) => (file.path === selected ? { ...file, content: value } : file)));
  }

  function commitChanges() {
    const trimmed = message.trim();
    if (!trimmed) return;
    setCommits((items) => [
      { message: trimmed, date: new Date().toLocaleString("ar"), files: files.length },
      ...items,
    ]);
    setMessage("");
  }

  async function importZip(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
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
    event.target.value = "";
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
        <span className="badge">MVP • Local Workspace</span>
      </header>

      <section className="dashboard">
        <aside className="card sidebar">
          <h2>المستودع</h2>
          <div className="repo">
            <strong>telegram-gitcode-hub</strong>
            <span className="muted">main · {files.length} ملفات</span>
          </div>
          <div className="actions">
            <label className="btn primary">
              رفع ZIP
              <input hidden type="file" accept=".zip,application/zip" onChange={importZip} />
            </label>
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
            <div><h1>محرر الملفات</h1><span className="muted">نسخة أولية: رفع، استعراض، تعديل، Commit، وتنزيل.</span></div>
          </div>
          <div className="card editorGrid">
            <nav className="tree">
              <div className="treeTitle">FILES</div>
              {fileNames.map((file) => (
                <button key={file.path} className={`file ${selected === file.path ? "active" : ""}`} onClick={() => setSelected(file.path)}>
                  {file.path}
                </button>
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
