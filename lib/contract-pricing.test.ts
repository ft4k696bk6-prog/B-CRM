import { describe, expect, it } from "vitest";
import { calculateContractPricing } from "@/lib/contract-pricing";

describe("contract commission pricing", () => {
  it("always converts contract gross price using 8% VAT", () => {
    const result = calculateContractPricing({
      product_type: "ME",
      gross_amount: 40000,
      storage_capacity_kwh: 10.24,
      has_inverter: true,
      inverter_power_kw: 8,
      mounting_locations: [],
      backup_power: false,
      boiler_capacity: "none",
      ems: false,
      cable_length_meters: 8,
      pricing_adjustment_net: 0,
      company_margin_net: 5000,
    });

    expect(result.saleNet).toBe(37037.04);
    expect(result.baseNet).toBe(29782);
    expect(result.marginNet).toBe(7255.04);
    expect(result.error).toBeNull();
  });

  it("uses the same calculator base price for rounded storage capacity", () => {
    const rounded = calculateContractPricing({
      product_type: "ME",
      gross_amount: 40000,
      storage_capacity_kwh: 10,
      has_inverter: true,
      inverter_power_kw: 8,
      mounting_locations: [],
      backup_power: false,
      boiler_capacity: "none",
      ems: false,
      cable_length_meters: 8,
      pricing_adjustment_net: 0,
      company_margin_net: 5000,
    });
    expect(rounded.baseNet).toBe(29782);
    expect(rounded.error).toBeNull();
  });

  it("adds the calculator extras to the base price", () => {
    const result = calculateContractPricing({
      product_type: "PV",
      gross_amount: 50000,
      panels_count: 10,
      has_inverter: true,
      inverter_power_kw: 5,
      mounting_locations: ["Grunt"],
      backup_power: true,
      boiler_capacity: "80",
      ems: true,
      cable_length_meters: 18,
      pricing_adjustment_net: 250,
      company_margin_net: 10000,
    });

    // 41313 - 15000 + company margin 10000 + ground 5kWp*550
    // + backup 1500 + boiler 1500 + EMS 3000 + cable + adjustment.
    expect(result.baseNet).toBe(45463);
    expect(result.error).toBeNull();
  });
});
