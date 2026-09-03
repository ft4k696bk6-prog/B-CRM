import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";
import { canManagePricing } from "@/lib/pricing-access";

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  if (!canManagePricing(auth.profile.role)) return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });

  const { data, error } = await auth.supabaseAdmin
    .from("profiles")
    .select("company_margin_net,sales_margin_net")
    .eq("id", auth.profile.id)
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || "Nie znaleziono ustawień." }, { status: 400 });
  return NextResponse.json({ adminMargin: Number(data.company_margin_net), salesMargin: Number(data.sales_margin_net) });
}

export async function PATCH(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;
  if (!canManagePricing(auth.profile.role)) return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const adminMargin = Number(body.adminMargin);
  const salesMargin = Number(body.salesMargin);
  if (!Number.isFinite(adminMargin) || adminMargin < 0 || !Number.isFinite(salesMargin) || salesMargin < 0) {
    return NextResponse.json({ error: "Marże muszą być nieujemnymi liczbami." }, { status: 400 });
  }
  const { error } = await auth.supabaseAdmin
    .from("profiles")
    .update({ company_margin_net: adminMargin, sales_margin_net: salesMargin })
    .eq("id", auth.profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ adminMargin, salesMargin });
}
