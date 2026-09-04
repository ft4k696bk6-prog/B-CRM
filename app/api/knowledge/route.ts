import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";
import { BUILT_IN_KNOWLEDGE, filterKnowledge, knowledgeCategories, type KnowledgeArticle } from "@/lib/knowledge-catalog";

export async function GET(request: Request) {
  const auth = await requireApiProfile(request); if ("error" in auth) return auth.error;
  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim() || "";
  const category = params.get("category")?.trim() || "";
  if (params.get("categories") === "1") {
    const { data, error } = await auth.supabaseAdmin.from("knowledge_articles").select("category").eq("crm_environment", auth.profile.crm_environment).limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ categories: knowledgeCategories([...(data || []).map((item) => ({ ...BUILT_IN_KNOWLEDGE[0], id: `category-${item.category}`, category: item.category })), ...BUILT_IN_KNOWLEDGE]) });
  }
  const query = auth.supabaseAdmin.from("knowledge_articles").select("*").eq("crm_environment", auth.profile.crm_environment).order("updated_at", { ascending: false });
  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const databaseArticles = (data || []) as KnowledgeArticle[];
  const allArticles = [...databaseArticles, ...BUILT_IN_KNOWLEDGE];
  return NextResponse.json({
    articles: filterKnowledge(allArticles, search, category),
    categories: knowledgeCategories(allArticles),
  });
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
