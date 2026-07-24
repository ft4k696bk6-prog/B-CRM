import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";

const PAGE_SIZE = 1000;

type HistoryRow = {
  lead_id: string;
  user_id: string | null;
  action_type: string;
};

function validDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
}

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;

  const { profile, supabaseAdmin } = auth;
  if (profile.role !== "owner" && profile.role !== "admin") {
    return NextResponse.json({ error: "Tylko administrator może przeglądać aktywność użytkowników." }, { status: 403 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const userId = url.searchParams.get("userId");

  if (!validDate(from) || !validDate(to) || from! > to!) {
    return NextResponse.json({ error: "Podaj poprawny zakres dat." }, { status: 400 });
  }

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,email,role")
    .eq("crm_environment", profile.crm_environment)
    .in("role", ["handlowiec", "sales"])
    .order("full_name", { ascending: true });

  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 400 });

  const visibleProfiles = (profiles || []).filter((person) => !userId || person.id === userId);
  const profileIds = visibleProfiles.map((person) => person.id);
  if (profileIds.length === 0) {
    return NextResponse.json({ from, to, summaries: [] });
  }

  const rows: HistoryRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("lead_history")
      .select("lead_id,user_id,action_type,lead:leads!inner(crm_environment)")
      .in("user_id", profileIds)
      .eq("lead.crm_environment", profile.crm_environment)
      .gte("created_at", `${from}T00:00:00.000Z`)
      .lte("created_at", `${to}T23:59:59.999Z`)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const page = (data || []) as unknown as HistoryRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const summaries = visibleProfiles.map((person) => {
    const userRows = rows.filter((row) => row.user_id === person.id);
    return {
      userId: person.id,
      fullName: person.full_name,
      email: person.email,
      openedLeads: new Set(userRows.filter((row) => row.action_type === "lead_opened").map((row) => row.lead_id)).size,
      statusChanges: userRows.filter((row) => row.action_type === "status_change").length,
      comments: userRows.filter((row) => row.action_type === "comment").length
    };
  });

  return NextResponse.json({ from, to, summaries });
}
