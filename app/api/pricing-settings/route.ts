import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/server-auth";
import { canManagePricing } from "@/lib/pricing-access";

const DEFAULT_LOAN_RATE = 6;

export async function GET(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;

  const [{ data, error }, { data: ownerSettings }] = await Promise.all([
    auth.supabaseAdmin
      .from("profiles")
      .select("company_margin_net,sales_margin_net,commission_percent")
      .eq("id", auth.profile.id)
      .single(),
    auth.supabaseAdmin
      .from("profiles")
      .select("offer_loan_rate_percent")
      .eq("crm_environment", auth.profile.crm_environment)
      .eq("role", "owner")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error || !data)
    return NextResponse.json(
      { error: error?.message || "Nie znaleziono ustawień." },
      { status: 400 },
    );

  const loanRate = Number.isFinite(Number(ownerSettings?.offer_loan_rate_percent))
    ? Number(ownerSettings?.offer_loan_rate_percent)
    : DEFAULT_LOAN_RATE;

  if (!canManagePricing(auth.profile.role)) {
    return NextResponse.json({
      totalMarginNet:
        Number(data.company_margin_net) + Number(data.sales_margin_net),
      ...(auth.profile.role === "handlowiec"
        ? {
            salesMargin: Number(data.sales_margin_net),
            commissionPercent: Number(data.commission_percent),
          }
        : {}),
      loanRate,
    });
  }

  return NextResponse.json({
    adminMargin: Number(data.company_margin_net),
    salesMargin: Number(data.sales_margin_net),
    commissionPercent: Number(data.commission_percent),
    loanRate,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiProfile(request);
  if ("error" in auth) return auth.error;

  const canManageAllPricing = canManagePricing(auth.profile.role);
  const canManageOwnSalesMargin = auth.profile.role === "handlowiec";
  if (!canManageAllPricing && !canManageOwnSalesMargin)
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });

  const body = (await request.json()) as Record<string, unknown>;
  const salesMargin = Number(body.salesMargin);

  if (canManageOwnSalesMargin && !canManageAllPricing) {
    if (!Number.isFinite(salesMargin) || salesMargin < 0) {
      return NextResponse.json(
        { error: "Marża handlowca musi być nieujemna." },
        { status: 400 },
      );
    }

    const { error } = await auth.supabaseAdmin
      .from("profiles")
      .update({ sales_margin_net: salesMargin })
      .eq("id", auth.profile.id);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ salesMargin });
  }

  const adminMargin = Number(body.adminMargin);
  const commissionPercent = Number(body.commissionPercent);
  const loanRate = Number(body.loanRate);

  if (
    !Number.isFinite(adminMargin) ||
    adminMargin < 0 ||
    !Number.isFinite(salesMargin) ||
    salesMargin < 0 ||
    !Number.isFinite(commissionPercent) ||
    commissionPercent < 0 ||
    commissionPercent > 100 ||
    (auth.profile.role === "owner" &&
      (!Number.isFinite(loanRate) || loanRate < 0 || loanRate > 100))
  ) {
    return NextResponse.json(
      {
        error:
          "Marże muszą być nieujemne, prowizja mieścić się w zakresie 0–100%, a oprocentowanie w zakresie 0–100%.",
      },
      { status: 400 },
    );
  }

  const profileUpdate: Record<string, number> = {
    company_margin_net: adminMargin,
    sales_margin_net: salesMargin,
    commission_percent: commissionPercent,
  };

  if (auth.profile.role === "owner") {
    profileUpdate.offer_loan_rate_percent = loanRate;
  }

  const { error } = await auth.supabaseAdmin
    .from("profiles")
    .update(profileUpdate)
    .eq("id", auth.profile.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    adminMargin,
    salesMargin,
    commissionPercent,
    ...(auth.profile.role === "owner" ? { loanRate } : {}),
  });
}
