import {
  EXTRA_NET_PRICES,
  INCLUDED_TOTAL_MARGIN_NET,
  INVERTER_NET_PRICES,
  PACKAGE_OPTIONS,
  PRICE_ROWS,
  STORAGE_NET_PRICES,
  recommendedInverter,
  type PackageId,
} from "@/lib/pricing";

export const CONTRACT_VAT_RATE = 8;
export const INCLUDED_CABLE_METERS = 8;
export const EMS_NET_PRICE = 3_000;

export type ContractPricingInput = {
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
  company_margin_net?: number | string | null;
};

export type ContractPricingResult = {
  saleGross: number;
  saleNet: number;
  baseNet: number | null;
  marginNet: number | null;
  error: string | null;
};

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function exactPriceRow(panelCount: number) {
  return PRICE_ROWS.find((row) => row.panelCount === panelCount) || null;
}

function packageForStorage(storageKwh: number): PackageId | null {
  const match = PACKAGE_OPTIONS.find(
    (item) => item.id !== "pv-only" && Math.abs(item.storageKwh - storageKwh) <= 0.3,
  );
  return match?.id || null;
}

function storagePrice(storageKwh: number) {
  return (
    STORAGE_NET_PRICES.find((item) => Math.abs(item.kwh - storageKwh) <= 0.3) ||
    null
  );
}

function inverterPrice(inverterKw: number) {
  return (
    INVERTER_NET_PRICES.find((item) => Math.abs(item.kw - inverterKw) < 0.02) ||
    null
  );
}

export function calculateContractPricing(
  input: ContractPricingInput,
): ContractPricingResult {
  const saleGross = Math.max(numberValue(input.gross_amount) || 0, 0);
  const saleNet = money(saleGross / (1 + CONTRACT_VAT_RATE / 100));

  if (!["PV", "ME", "PV+ME"].includes(input.product_type)) {
    return {
      saleGross,
      saleNet,
      baseNet: null,
      marginNet: null,
      error: "Stara umowa nie ma konfiguracji zgodnej z aktualnym kalkulatorem.",
    };
  }

  if (saleGross <= 0) {
    return {
      saleGross,
      saleNet,
      baseNet: null,
      marginNet: null,
      error: "Brakuje ceny sprzedaży brutto.",
    };
  }

  let cennikNet = 0;
  let inverterAdjustmentNet = 0;
  let pvKwp = 0;

  if (input.product_type === "PV" || input.product_type === "PV+ME") {
    const panelCount = numberValue(input.panels_count);
    if (!panelCount || !Number.isInteger(panelCount)) {
      return {
        saleGross,
        saleNet,
        baseNet: null,
        marginNet: null,
        error: "Brakuje poprawnej liczby paneli do wyliczenia ceny bazowej.",
      };
    }

    const row = exactPriceRow(panelCount);
    if (!row) {
      return {
        saleGross,
        saleNet,
        baseNet: null,
        marginNet: null,
        error: `Kalkulator nie ma ceny dla ${panelCount} paneli.`,
      };
    }
    pvKwp = row.kwp;

    if (input.product_type === "PV") {
      cennikNet = row.prices["pv-only"];
    } else {
      const storageKwh = numberValue(input.storage_capacity_kwh);
      if (!storageKwh) {
        return {
          saleGross,
          saleNet,
          baseNet: null,
          marginNet: null,
          error: "Brakuje pojemności magazynu energii.",
        };
      }
      const packageId = packageForStorage(storageKwh);
      if (!packageId) {
        return {
          saleGross,
          saleNet,
          baseNet: null,
          marginNet: null,
          error: `Kalkulator nie ma pakietu PV + ME ${storageKwh} kWh.`,
        };
      }
      cennikNet = row.prices[packageId];
    }

    const inverterKw = numberValue(input.inverter_power_kw);
    if (!inverterKw) {
      return {
        saleGross,
        saleNet,
        baseNet: null,
        marginNet: null,
        error: "Brakuje mocy falownika do wyliczenia ceny bazowej.",
      };
    }
    const inverter = inverterPrice(inverterKw);
    if (!inverter) {
      return {
        saleGross,
        saleNet,
        baseNet: null,
        marginNet: null,
        error: `Kalkulator nie ma falownika ${inverterKw} kW.`,
      };
    }
    inverterAdjustmentNet = inverter.net - recommendedInverter(row.kwp).net;
  } else {
    const storageKwh = numberValue(input.storage_capacity_kwh);
    if (!storageKwh) {
      return {
        saleGross,
        saleNet,
        baseNet: null,
        marginNet: null,
        error: "Brakuje pojemności magazynu energii.",
      };
    }
    const storage = storagePrice(storageKwh);
    if (!storage) {
      return {
        saleGross,
        saleNet,
        baseNet: null,
        marginNet: null,
        error: `Kalkulator nie ma magazynu ${storageKwh} kWh.`,
      };
    }

    let inverterNet = 0;
    if (input.has_inverter !== false) {
      const inverterKw = numberValue(input.inverter_power_kw);
      if (!inverterKw) {
        return {
          saleGross,
          saleNet,
          baseNet: null,
          marginNet: null,
          error: "Brakuje mocy falownika do wyliczenia ceny bazowej.",
        };
      }
      const inverter = inverterPrice(inverterKw);
      if (!inverter) {
        return {
          saleGross,
          saleNet,
          baseNet: null,
          marginNet: null,
          error: `Kalkulator nie ma falownika ${inverterKw} kW.`,
        };
      }
      inverterNet = inverter.net;
    }

    cennikNet = storage.net + inverterNet;
  }

  const mounting = input.mounting_locations || [];
  const groundMount = mounting.some(
    (item) => item.trim().toLocaleLowerCase("pl-PL") === "grunt",
  );
  const triangles = mounting.some((item) =>
    item.toLocaleLowerCase("pl-PL").includes("ekierki"),
  );

  const pvExtras =
    input.product_type === "ME"
      ? 0
      : (groundMount ? pvKwp * EXTRA_NET_PRICES.groundPerKw : 0) +
        (triangles ? pvKwp * EXTRA_NET_PRICES.ekierkiPerKw : 0);

  const boilerCapacity = String(input.boiler_capacity || "none");
  const boilerNet =
    boilerCapacity === "80"
      ? EXTRA_NET_PRICES.boiler80
      : boilerCapacity === "150"
        ? EXTRA_NET_PRICES.boiler150
        : 0;

  const cableLength = Math.max(
    numberValue(input.cable_length_meters) ?? INCLUDED_CABLE_METERS,
    0,
  );
  const chargeableCableMeters = Math.max(cableLength - INCLUDED_CABLE_METERS, 0);
  const extrasNet =
    pvExtras +
    boilerNet +
    (input.backup_power ? EXTRA_NET_PRICES.backup : 0) +
    (input.ems ? EMS_NET_PRICE : 0) +
    chargeableCableMeters * EXTRA_NET_PRICES.cablePerMeterAbove8m +
    (numberValue(input.pricing_adjustment_net) || 0);

  const companyMarginNet = Math.max(numberValue(input.company_margin_net) || 0, 0);
  const calculatorCostNet = Math.max(
    cennikNet + inverterAdjustmentNet - INCLUDED_TOTAL_MARGIN_NET + extrasNet,
    0,
  );
  const baseNet = money(calculatorCostNet + companyMarginNet);
  const marginNet = money(saleNet - baseNet);

  return {
    saleGross,
    saleNet,
    baseNet,
    marginNet,
    error: null,
  };
}
