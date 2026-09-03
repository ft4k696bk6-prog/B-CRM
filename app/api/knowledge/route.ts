import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";

export async function GET(request: Request) {
  const auth = await requireApiProfile(request); if ("error" in auth) return auth.error;
  const search = new URL(request.url).searchParams.get("q")?.trim() || "";
  let query = auth.supabaseAdmin.from("knowledge_articles").select("*").eq("crm_environment", auth.profile.crm_environment).order("updated_at", { ascending: false });
  if (search) query = query.or(`title.ilike.%${search.replace(/[,%]/g, " ")}%,content.ilike.%${search.replace(/[,%]/g, " ")}%,category.ilike.%${search.replace(/[,%]/g, " ")}%`);
  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ articles: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(request); if ("error" in auth) return auth.error;
  if (!["owner", "admin"].includes(auth.profile.role)) return NextResponse.json({ error: "Tylko administrator może dodawać wiedzę." }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const title = String(body.title || "").trim(); const content = String(body.content || "").trim();
  if (!title || !content) return NextResponse.json({ error: "Wpisz tytuł i treść." }, { status: 400 });
  const { data, error } = await auth.supabaseAdmin.from("knowledge_articles").insert({
    title: title.slice(0, 200), content, category: String(body.category || "Ogólne").trim().slice(0, 80),
    source_url: String(body.sourceUrl || "").trim() || null, created_by: auth.profile.id, crm_environment: auth.profile.crm_environment
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ article: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireApiProfile(request); if ("error" in auth) return auth.error;
  if (!["owner", "admin"].includes(auth.profile.role)) return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Brak artykułu." }, { status: 400 });
  const { error } = await auth.supabaseAdmin.from("knowledge_articles").delete().eq("id", id).eq("crm_environment", auth.profile.crm_environment);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: id });
}
