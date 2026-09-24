export type PackageId = "pv-only" | "me-5" | "me-10" | "me-16" | "me-20" | "me-23" | "me-28";
export type OfferMode = "pv" | "pv-storage" | "storage";
export type RainwaterSystem = "none" | "above-2000" | "underground-2000";
export type BoilerCapacity = "none" | "80" | "150";
export type BoilerLayout = "vertical" | "horizontal";

export type PriceRow = {
  panelCount: number;
  kwp: number;
  prices: Record<PackageId, number>;
};

export const INCLUDED_TOTAL_MARGIN_NET = 40_000;
export const DEFAULT_ADMIN_MARGIN_NET = 35_000;
export const DEFAULT_SALES_MARGIN_NET = 30_000;

export const PACKAGE_OPTIONS: Array<{
  id: PackageId;
  label: string;
  shortLabel: string;
  storageKwh: number;
  brands: string[];
}> = [
  {
    id: "pv-only",
    label: "Samo foto",
    shortLabel: "PV",
    storageKwh: 0,
    brands: ["Brak magazynu"]
  },
  {
    id: "me-5",
    label: "PV + magazyn 5,12 kWh",
    shortLabel: "5,12 kWh",
    storageKwh: 5.12,
    brands: ["Kon-TEC", "Deye"]
  },
  {
    id: "me-10",
    label: "PV + magazyn 10,24 kWh",
    shortLabel: "10,24 kWh",
    storageKwh: 10.24,
    brands: ["Kon-TEC", "Deye"]
  },
  {
    id: "me-16",
    label: "PV + magazyn 16 kWh",
    shortLabel: "16 kWh",
    storageKwh: 16,
    brands: ["Kon-TEC", "Deye"]
  },
  {
    id: "me-20",
    label: "PV + magazyn 20 kWh",
    shortLabel: "20 kWh",
    storageKwh: 20,
    brands: ["Kon-TEC", "Deye"]
  },
  {
    id: "me-23",
    label: "PV + Felicity 23,5 kWh",
    shortLabel: "23,5 kWh",
    storageKwh: 23.5,
    brands: ["Felicity"]
  },
  {
    id: "me-28",
    label: "PV + Felicity 28 kWh",
    shortLabel: "28 kWh",
    storageKwh: 28,
    brands: ["Felicity"]
  }
];

const PUBLISHED_PRICE_ROWS: PriceRow[] = [
  { panelCount: 4, kwp: 2, prices: { "pv-only": 61873, "me-5": 69556, "me-10": 71955, "me-16": 73889, "me-20": 78347, "me-23": 79077, "me-28": 81002 } },
  { panelCount: 5, kwp: 2.5, prices: { "pv-only": 62613, "me-5": 70296, "me-10": 72695, "me-16": 74629, "me-20": 79087, "me-23": 79817, "me-28": 81742 } },
  { panelCount: 6, kwp: 3, prices: { "pv-only": 63353, "me-5": 71036, "me-10": 73435, "me-16": 75369, "me-20": 79827, "me-23": 80557, "me-28": 82482 } },
  { panelCount: 7, kwp: 3.5, prices: { "pv-only": 64093, "me-5": 71776, "me-10": 74175, "me-16": 76109, "me-20": 80567, "me-23": 81297, "me-28": 83222 } },
  { panelCount: 8, kwp: 4, prices: { "pv-only": 64833, "me-5": 72516, "me-10": 74915, "me-16": 76849, "me-20": 81307, "me-23": 82037, "me-28": 83962 } },
  { panelCount: 9, kwp: 4.5, prices: { "pv-only": 65573, "me-5": 73256, "me-10": 75655, "me-16": 77589, "me-20": 82047, "me-23": 82777, "me-28": 84702 } },
  { panelCount: 10, kwp: 5, prices: { "pv-only": 66313, "me-5": 73996, "me-10": 76395, "me-16": 78329, "me-20": 82787, "me-23": 83517, "me-28": 85442 } },
  { panelCount: 11, kwp: 5.5, prices: { "pv-only": 68477, "me-5": 76160, "me-10": 78559, "me-16": 80493, "me-20": 84951, "me-23": 85681, "me-28": 87606 } },
  { panelCount: 12, kwp: 6, prices: { "pv-only": 69217, "me-5": 76900, "me-10": 79299, "me-16": 81233, "me-20": 85691, "me-23": 86421, "me-28": 88346 } },
  { panelCount: 13, kwp: 6.5, prices: { "pv-only": 71137, "me-5": 78820, "me-10": 81219, "me-16": 83153, "me-20": 87611, "me-23": 88341, "me-28": 90266 } },
  { panelCount: 14, kwp: 7, prices: { "pv-only": 71877, "me-5": 79560, "me-10": 81959, "me-16": 83893, "me-20": 88351, "me-23": 89081, "me-28": 91006 } },
  { panelCount: 15, kwp: 7.5, prices: { "pv-only": 72617, "me-5": 80300, "me-10": 82699, "me-16": 84633, "me-20": 89091, "me-23": 89821, "me-28": 91746 } },
  { panelCount: 16, kwp: 8, prices: { "pv-only": 73357, "me-5": 81040, "me-10": 83439, "me-16": 85373, "me-20": 89831, "me-23": 90561, "me-28": 92486 } },
  { panelCount: 17, kwp: 8.5, prices: { "pv-only": 74097, "me-5": 81780, "me-10": 84179, "me-16": 86113, "me-20": 90571, "me-23": 91301, "me-28": 93226 } },
  { panelCount: 18, kwp: 9, prices: { "pv-only": 74837, "me-5": 82520, "me-10": 84919, "me-16": 86853, "me-20": 91311, "me-23": 92041, "me-28": 93966 } },
  { panelCount: 19, kwp: 9.5, prices: { "pv-only": 75897, "me-5": 83580, "me-10": 85979, "me-16": 87913, "me-20": 92371, "me-23": 93101, "me-28": 95026 } },
  { panelCount: 20, kwp: 10, prices: { "pv-only": 76637, "me-5": 84320, "me-10": 86719, "me-16": 88653, "me-20": 93111, "me-23": 93841, "me-28": 95766 } },
  { panelCount: 21, kwp: 10.5, prices: { "pv-only": 77377, "me-5": 85060, "me-10": 87459, "me-16": 89393, "me-20": 93851, "me-23": 94581, "me-28": 96506 } }
];

// Until the company supplies published rates above 10.5 kW, extend every
// package by the last confirmed step: PLN 740 net per additional 0.5 kWp.
// Keeping this explicit makes the temporary rule auditable and easy to replace.
const FALLBACK_HALF_KWP_STEP_NET = 740;
const publishedLastRow = PUBLISHED_PRICE_ROWS[PUBLISHED_PRICE_ROWS.length - 1];
const FALLBACK_PRICE_ROWS: PriceRow[] = Array.from({ length: 19 }, (_, index) => {
  const step = index + 1;
  return {
    panelCount: publishedLastRow.panelCount + step,
    kwp: publishedLastRow.kwp + step * 0.5,
    prices: Object.fromEntries(
      Object.entries(publishedLastRow.prices).map(([packageId, price]) => [packageId, price + step * FALLBACK_HALF_KWP_STEP_NET])
    ) as Record<PackageId, number>
  };
});

export const PRICE_ROWS: PriceRow[] = [...PUBLISHED_PRICE_ROWS, ...FALLBACK_PRICE_ROWS];

export const STORAGE_NET_PRICES = [
  { id: "kon-tec-5", brand: "Kon-TEC", label: "Kon-TEC ME 5,12 kWh", kwh: 5.12, net: 55683 },
  { id: "kon-tec-10", brand: "Kon-TEC", label: "Kon-TEC ME 10,24 kWh", kwh: 10.24, net: 58082 },
  { id: "kon-tec-16", brand: "Kon-TEC", label: "Kon-TEC ME 16 kWh", kwh: 16, net: 60016 },
  { id: "kon-tec-20", brand: "Kon-TEC", label: "Kon-TEC ME 20 kWh", kwh: 20, net: 64474 },
  { id: "deye-5", brand: "Deye", label: "Deye 5,12 kWh", kwh: 5.12, net: 55683 },
  { id: "deye-10", brand: "Deye", label: "Deye 10,24 kWh", kwh: 10.24, net: 58082 },
  { id: "deye-16", brand: "Deye", label: "Deye 16 kWh", kwh: 16, net: 60016 },
  { id: "deye-20", brand: "Deye", label: "Deye 20 kWh", kwh: 20, net: 64474 },
  { id: "felicity-23", brand: "Felicity", label: "Felicity 23,5 kWh", kwh: 23.5, net: 65204 },
  { id: "felicity-28", brand: "Felicity", label: "Felicity 28 kWh", kwh: 28, net: 67129 }
];

export const INVERTER_NET_PRICES = [
  { kw: 0, label: "Bez falownika", net: 0 },
  { kw: 5, label: "Deye hybrydowy niskonapięciowy 5 kW", net: 31500 },
  { kw: 8, label: "Deye hybrydowy niskonapięciowy 8 kW", net: 31700 },
  { kw: 10, label: "Deye hybrydowy niskonapięciowy 10 kW", net: 31900 },
  { kw: 12, label: "Deye hybrydowy niskonapięciowy 12 kW", net: 32100 }
];

export const EXTRA_NET_PRICES = {
  groundPerKw: 25550,
  ekierkiPerKw: 25500,
  boiler80: 26500,
  boiler150: 27000,
  backup: 26500,
  cablePerMeterAbove8m: 25015,
  referralReward: 25500,
  rainwaterAbove2000: 28000,
  rainwaterUnderground2000: 35000
};

export function recommendedInverter(kwp: number) {
  if (kwp <= 5) return INVERTER_NET_PRICES[1];
  if (kwp <= 8) return INVERTER_NET_PRICES[2];
  if (kwp <= 10) return INVERTER_NET_PRICES[3];
  return INVERTER_NET_PRICES[4];
}

export function getPriceRowByPanelCount(panelCount: number) {
  return PRICE_ROWS.find((row) => row.panelCount === panelCount) || PRICE_ROWS[0];
}
