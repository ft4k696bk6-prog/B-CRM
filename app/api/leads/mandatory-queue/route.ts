import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";
import { getMandatoryLeads } from "@/lib/server-lead-work";

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  if (auth.profile.role !== "handlowiec") return NextResponse.json({ leads: [] });

  try {
    return NextResponse.json({ leads: await getMandatoryLeads(auth.supabaseAdmin, auth.profile) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nie udało się pobrać kolejki." }, { status: 400 });
  }
}
