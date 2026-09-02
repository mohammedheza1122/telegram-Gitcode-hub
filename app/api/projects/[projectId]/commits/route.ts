import { NextResponse } from "next/server";
import { authenticateTelegram } from "../../../../../lib/api-auth";

type Params = { params: Promise<{ projectId: string }> };

type CommitFile = { path?: string; content?: string };

export async function GET(request: Request, { params }: Params) {
  const auth = await authenticateTelegram(request);
  if ("response" in auth) return auth.response;
  const projectId = Number((await params).projectId);
  if (!Number.isInteger(projectId)) return NextResponse.json({ ok: false, error: "Invalid project id" }, { status: 400 });

  const { data: project } = await auth.admin.from("projects").select("id").eq("id", projectId).eq("owner_id", auth.dbUserId).maybeSingle();
  if (!project) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });

  const { data, error } = await auth.admin.from("commits").select("id,message,created_at,author_id").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ ok: false, error: "Unable to load commit history" }, { status: 500 });
  return NextResponse.json({ ok: true, commits: data ?? [] });
}

export async function POST(request: Request, { params }: Params) {
  const auth = await authenticateTelegram(request);
  if ("response" in auth) return auth.response;
  const projectId = Number((await params).projectId);
  if (!Number.isInteger(projectId)) return NextResponse.json({ ok: false, error: "Invalid project id" }, { status: 400 });

  const { data: project } = await auth.admin.from("projects").select("id").eq("id", projectId).eq("owner_id", auth.dbUserId).maybeSingle();
  if (!project) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { message?: string; files?: CommitFile[] } | null;
  const message = body?.message?.trim();
  if (!message || message.length > 200) return NextResponse.json({ ok: false, error: "Commit message is required and must be at most 200 characters" }, { status: 400 });
  if (!Array.isArray(body?.files) || body.files.length > 500) return NextResponse.json({ ok: false, error: "Invalid commit files" }, { status: 400 });

  const files = body.files.map((file) => ({ path: String(file.path ?? "").trim(), content: String(file.content ?? "") }));
  if (files.some((file) => !file.path || file.path.length > 500 || file.path.startsWith("/") || file.path.includes(".."))) {
    return NextResponse.json({ ok: false, error: "Invalid file path" }, { status: 400 });
  }

  // Persist the working tree first, then snapshot exactly what was committed.
  const now = new Date().toISOString();
  const upserts = files.map((file) => ({
    project_id: projectId,
    path: file.path,
    content: file.content,
    size_bytes: Buffer.byteLength(file.content, "utf8"),
    updated_at: now,
  }));
  if (upserts.length) {
    const { error } = await auth.admin.from("files").upsert(upserts, { onConflict: "project_id,path" });
    if (error) return NextResponse.json({ ok: false, error: "Unable to save files before commit" }, { status: 500 });
  }

  const { data: commit, error: commitError } = await auth.admin
    .from("commits")
    .insert({ project_id: projectId, author_id: auth.dbUserId, message })
    .select("id,message,created_at,author_id")
    .single();
  if (commitError || !commit) return NextResponse.json({ ok: false, error: "Unable to create commit" }, { status: 500 });

  const { data: currentFiles, error: currentError } = await auth.admin.from("files").select("id,path,content").eq("project_id", projectId);
  if (currentError) return NextResponse.json({ ok: false, error: "Commit created but snapshot could not be loaded" }, { status: 500 });

  const snapshots = (currentFiles ?? []).map((file) => ({ commit_id: commit.id, file_id: file.id, content: file.content }));
  if (snapshots.length) {
    const { error } = await auth.admin.from("commit_files").insert(snapshots);
    if (error) return NextResponse.json({ ok: false, error: "Commit created but snapshot could not be saved" }, { status: 500 });
  }

  await auth.admin.from("projects").update({ updated_at: now }).eq("id", projectId);
  return NextResponse.json({ ok: true, commit }, { status: 201 });
}
