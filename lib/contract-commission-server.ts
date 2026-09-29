import { calculateContractPricing } from "@/lib/contract-pricing";
import { getServiceClient } from "@/lib/server-auth";

type ServiceClient = ReturnType<typeof getServiceClient>;

type CommissionContract = {
  id: string;
  created_by: string;
  product_type: "PV" | "ME" | "PV+ME";
  gross_amount: number | string | null;
  panels_count?: number | string | null;
  storage_capacity_kwh?: number | string | null;
  has_inverter?: boolean | null;
  inverter_power_kw?: number | string | null;
  mounting_locations?: string[] | null;
  backup_power?: boolean | null;
  boiler_capacity?: string | null;
  ems?: boolean | null;
  cable_length_meters?: number | string | null;
  pricing_adjustment_net?: number | string | null;
  commission_company_margin_net?: number | string | null;
  commission_percent?: number | string | null;
};

export async function recalculateContractCommission(
  supabaseAdmin: ServiceClient,
  contractId: string,
  options?: { refreshPercent?: boolean },
) {
  const { data: contract, error: contractError } = await supabaseAdmin
    .from("contracts")
    .select(
      "id,created_by,product_type,gross_amount,panels_count,storage_capacity_kwh,has_inverter,inverter_power_kw,mounting_locations,backup_power,boiler_capacity,ems,cable_length_meters,pricing_adjustment_net,commission_company_margin_net,commission_percent",
    )
    .eq("id", contractId)
    .single();

  if (contractError || !contract) {
    throw new Error(contractError?.message || "Nie znaleziono umowy do wyliczenia prowizji.");
  }

  const typedContract = contract as CommissionContract;
  let commissionPercent = Number(typedContract.commission_percent) || 0;
  let companyMarginNet = Number(typedContract.commission_company_margin_net);

  if (
    options?.refreshPercent ||
    !Number.isFinite(commissionPercent) ||
    !Number.isFinite(companyMarginNet)
  ) {
    const { data: creator, error: creatorError } = await supabaseAdmin
      .from("profiles")
      .select("commission_percent,company_margin_net")
      .eq("id", typedContract.created_by)
      .single();
    if (creatorError || !creator) {
      throw new Error(creatorError?.message || "Nie znaleziono ustawień prowizji handlowca.");
    }
    if (options?.refreshPercent || !Number.isFinite(commissionPercent)) {
      commissionPercent = Number(creator.commission_percent) || 0;
    }
    if (options?.refreshPercent || !Number.isFinite(companyMarginNet)) {
      companyMarginNet = Number(creator.company_margin_net) || 0;
    }
  }

  commissionPercent = Math.min(Math.max(commissionPercent, 0), 100);
  companyMarginNet = Math.max(Number(companyMarginNet) || 0, 0);
  const pricing = calculateContractPricing({
    ...typedContract,
    company_margin_net: companyMarginNet,
  });
  const marginNet = pricing.marginNet ?? 0;
  const commissionAmount =
    pricing.marginNet === null
      ? 0
      : Math.round(Math.max(pricing.marginNet, 0) * commissionPercent) / 100;

  const patch = {
    commission_sale_net: pricing.saleNet,
    commission_company_margin_net: companyMarginNet,
    commission_base_net: pricing.baseNet,
    commission_margin_net: marginNet,
    commission_percent: commissionPercent,
    commission_amount: commissionAmount,
    commission_calc_error: pricing.error,
    commission_calculated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabaseAdmin
    .from("contracts")
    .update(patch)
    .eq("id", contractId);
  if (updateError) throw new Error(updateError.message);

  return patch;
}

export function commissionSnapshotForNewContract(
  input: CommissionContract,
  commissionPercent: number,
  companyMarginNet: number,
) {
  const normalizedCompanyMarginNet = Math.max(Number(companyMarginNet) || 0, 0);
  const pricing = calculateContractPricing({
    ...input,
    company_margin_net: normalizedCompanyMarginNet,
  });
  const normalizedPercent = Math.min(Math.max(Number(commissionPercent) || 0, 0), 100);
  const marginNet = pricing.marginNet ?? 0;
  return {
    commission_sale_net: pricing.saleNet,
    commission_company_margin_net: normalizedCompanyMarginNet,
    commission_base_net: pricing.baseNet,
    commission_margin_net: marginNet,
    commission_percent: normalizedPercent,
    commission_amount:
      pricing.marginNet === null
        ? 0
        : Math.round(Math.max(pricing.marginNet, 0) * normalizedPercent) / 100,
    commission_calc_error: pricing.error,
    commission_calculated_at: new Date().toISOString(),
  };
}
