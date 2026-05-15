import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CreateFileBody = {
  lead_id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  description?: string;
};

function getSupabaseClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Brakuje konfiguracji Supabase");
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        authorization: `Bearer ${token}`
      }
    }
  });
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return NextResponse.json({ error: "Brak sesji" }, { status: 401 });
    }

    const url = new URL(request.url);
    const leadId = url.searchParams.get("lead_id");

    if (!leadId) {
      return NextResponse.json({ error: "Brak lead_id" }, { status: 400 });
    }

    const supabase = getSupabaseClient(token);

    const { data: files, error } = await supabase
      .from("lead_files")
      .select(
        `
        *,
        user_profile:uploaded_by(id,email,full_name,role)
      `
      )
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(files || []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return NextResponse.json({ error: "Brak sesji" }, { status: 401 });
    }

    const supabase = getSupabaseClient(token);

    const { data: user } = await supabase.auth.getUser();

    if (!user.user) {
      return NextResponse.json({ error: "Sesja wygasła" }, { status: 401 });
    }

    const body = (await request.json()) as CreateFileBody;

    const { data: file, error } = await supabase
      .from("lead_files")
      .insert({
        lead_id: body.lead_id,
        uploaded_by: user.user.id,
        file_name: body.file_name,
        file_path: body.file_path,
        file_size: body.file_size || null,
        mime_type: body.mime_type || null,
        description: body.description || null
      })
      .select(
        `
        *,
        user_profile:uploaded_by(id,email,full_name,role)
      `
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(file);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nieznany błąd" },
      { status: 500 }
    );
  }
}
