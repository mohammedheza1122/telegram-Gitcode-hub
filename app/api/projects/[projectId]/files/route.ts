import { NextResponse } from "next/server";
import { authenticateTelegram } from "../../../../../lib/api-auth";

type Params = { params: Promise<{ projectId: string }> };

async function ownedProject(admin: NonNullable<Awaited<ReturnType<typeof authenticateTelegram>> extends infer T ? any : never>, userId: number, projectId: number) {
  return admin.from("projects").select("id,name,default_branch").eq("id", projectId).eq("owner_id", userId).maybeSingle();
}

export async function GET(request: Request, { params }: Params) {
  const auth = await authenticateTelegram(request);
  if ("response" in auth) return auth.response;
  const projectId = Number((await params).projectId);
  if (!Number.isInteger(projectId)) return NextResponse.json({ ok: false, error: "Invalid project id" }, { status: 400 });

  const { data: project, error: projectError } = await auth.admin.from("projects").select("id,name,default_branch").eq("id", projectId).eq("owner_id", auth.dbUserId).maybeSingle();
  if (projectError) return NextResponse.json({ ok: false, error: "Unable to load project" }, { status: 500 });
  if (!project) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });

  const { data: files, error } = await auth.admin.from("files").select("id,path,content,size_bytes,updated_at").eq("project_id", projectId).order("path");
  if (error) return NextResponse.json({ ok: false, error: "Unable to load files" }, { status: 500 });
  return NextResponse.json({ ok: true, project, files: files ?? [] });
}

export async function PUT(request: Request, { params }: Params) {
  const auth = await authenticateTelegram(request);
  if ("response" in auth) return auth.response;
  const projectId = Number((await params).projectId);
  if (!Number.isInteger(projectId)) return NextResponse.json({ ok: false, error: "Invalid project id" }, { status: 400 });

  const { data: project } = await auth.admin.from("projects").select("id").eq("id", projectId).eq("owner_id", auth.dbUserId).maybeSingle();
  if (!project) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { files?: Array<{ path?: string; content?: string }> } | null;
  if (!Array.isArray(body?.files) || body.files.length > 500) return NextResponse.json({ ok: false, error: "files must be an array of at most 500 items" }, { status: 400 });

  const files = body.files.map((file) => ({
    project_id: projectId,
    path: String(file.path ?? "").trim(),
    content: String(file.content ?? ""),
    size_bytes: Buffer.byteLength(String(file.content ?? ""), "utf8"),
    updated_at: new Date().toISOString(),
  }));
  if (files.some((file) => !file.path || file.path.length > 500 || file.path.startsWith("/") || file.path.includes(".."))) {
    return NextResponse.json({ ok: false, error: "Invalid file path" }, { status: 400 });
  }

  const { data, error } = await auth.admin.from("files").upsert(files, { onConflict: "project_id,path" }).select("id,path,content,size_bytes,updated_at");
  if (error) return NextResponse.json({ ok: false, error: "Unable to save files" }, { status: 500 });
  await auth.admin.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", projectId);
  return NextResponse.json({ ok: true, files: data ?? [] });
}
