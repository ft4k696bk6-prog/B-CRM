import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const tokenHash = "858d3fc9ed3904254c710ad4be654384846526f75b06a9212680b6f8fc90f863";

function hasAccess(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : "";
  return Boolean(token && createHash("sha256").update(token).digest("hex") === tokenHash);
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server config.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: Request) {
  if (!hasAccess(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,manager_id,crm_environment")
    .eq("crm_environment", "production")
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profiles: data });
}
