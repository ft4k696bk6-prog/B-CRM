import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;

  const { profile, supabaseAdmin } = auth;
  if (!["owner", "admin", "menadzer", "finance", "viewer"].includes(profile.role)) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }
  let salespersonIds: string[] = [];

  if (profile.role === "menadzer") {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("crm_environment", profile.crm_environment)
      .or(`id.eq.${profile.id},manager_id.eq.${profile.id}`);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    salespersonIds = (data || []).map((person) => person.id);
  }

  const count = () => supabaseAdmin.from("leads").select("id", { count: "exact", head: true });

  function scoped(query: ReturnType<typeof count>) {
    const environmentQuery = query.eq("crm_environment", profile.crm_environment);
    if (profile.role !== "menadzer") return environmentQuery;
    return environmentQuery.or(
      salespersonIds.length
        ? `assigned_to.in.(${salespersonIds.join(",")}),assigned_to.is.null`
        : "assigned_to.is.null"
    );
  }

  const results = await Promise.all([
    scoped(count()),
    scoped(count()).is("assigned_to", null),
    scoped(count()).not("assigned_to", "is", null),
    scoped(count()).eq("status", "Call back"),
    scoped(count()).eq("status", "Spotkanie"),
    scoped(count()).eq("status", "Umowa"),
    scoped(count()).eq("status", "Rezygnacja"),
    scoped(count()).not("status", "in", '("Umowa","Rezygnacja")').is("callback_at", null).is("meeting_at", null)
  ]);

  const failed = results.find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 400 });
  const values = results.map((result) => result.count || 0);

  return NextResponse.json({
    stats: {
      all: values[0], unassigned: values[1], assigned: values[2], callbacks: values[3],
      meetings: values[4], contracts: values[5], resignations: values[6], noNextAction: values[7]
    }
  });
}
