import { NextResponse } from "next/server";
import { authenticateTelegram } from "../../../lib/api-auth";

export async function GET(request: Request) {
  const auth = await authenticateTelegram(request);
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.admin
    .from("projects")
    .select("id,name,description,default_branch,created_at,updated_at")
    .eq("owner_id", auth.dbUserId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Project list failed", error);
    return NextResponse.json({ ok: false, error: "Unable to load projects" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, projects: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authenticateTelegram(request);
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as { name?: string; description?: string } | null;
  const name = body?.name?.trim();
  if (!name || !/^[a-zA-Z0-9._-]{1,80}$/.test(name)) {
    return NextResponse.json({ ok: false, error: "Project name must use letters, numbers, dot, dash or underscore" }, { status: 400 });
  }

  const { data, error } = await auth.admin
    .from("projects")
    .insert({ owner_id: auth.dbUserId, name, description: body?.description?.trim() || null })
    .select("id,name,description,default_branch,created_at,updated_at")
    .single();

  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ ok: false, error: duplicate ? "A project with this name already exists" : "Unable to create project" }, { status: duplicate ? 409 : 500 });
  }
  return NextResponse.json({ ok: true, project: data }, { status: 201 });
}
