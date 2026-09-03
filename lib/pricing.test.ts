import { describe, expect, it } from "vitest";
import {
  EXTRA_NET_PRICES,
  INVERTER_NET_PRICES,
  PRICE_ROWS,
  STORAGE_NET_PRICES
} from "@/lib/pricing";

describe("pricing table", () => {
  it("matches the final PDF price list", () => {
    expect(STORAGE_NET_PRICES).toEqual([
      { id: "kon-tec-5", brand: "Kon-TEC", label: "Kon-TEC ME 5,12 kWh", kwh: 5.12, net: 30683 },
      { id: "kon-tec-10", brand: "Kon-TEC", label: "Kon-TEC ME 10,24 kWh", kwh: 10.24, net: 33082 },
      { id: "kon-tec-16", brand: "Kon-TEC", label: "Kon-TEC ME 16 kWh", kwh: 16, net: 35016 },
      { id: "kon-tec-20", brand: "Kon-TEC", label: "Kon-TEC ME 20 kWh", kwh: 20, net: 39474 },
      { id: "deye-5", brand: "Deye", label: "Deye 5,12 kWh", kwh: 5.12, net: 30683 },
      { id: "deye-10", brand: "Deye", label: "Deye 10,24 kWh", kwh: 10.24, net: 33082 },
      { id: "deye-16", brand: "Deye", label: "Deye 16 kWh", kwh: 16, net: 35016 },
      { id: "deye-20", brand: "Deye", label: "Deye 20 kWh", kwh: 20, net: 39474 },
      { id: "felicity-23", brand: "Felicity", label: "Felicity 23,5 kWh", kwh: 23.5, net: 40204 },
      { id: "felicity-28", brand: "Felicity", label: "Felicity 28 kWh", kwh: 28, net: 42129 }
    ]);

    expect(INVERTER_NET_PRICES).toEqual([
      { kw: 0, label: "Bez falownika", net: 0 },
      { kw: 5, label: "Deye hybrydowy niskonapięciowy 5 kW", net: 6500 },
      { kw: 8, label: "Deye hybrydowy niskonapięciowy 8 kW", net: 6700 },
      { kw: 10, label: "Deye hybrydowy niskonapięciowy 10 kW", net: 6900 },
      { kw: 12, label: "Deye hybrydowy niskonapięciowy 12 kW", net: 7100 }
    ]);

    expect(EXTRA_NET_PRICES).toMatchObject({
      groundPerKw: 550,
      ekierkiPerKw: 500,
      boiler80: 1500,
      boiler150: 2000,
      backup: 1500,
      cablePerMeterAbove8m: 15,
      referralReward: 500
    });

    expect(PRICE_ROWS.slice(0, 18)).toEqual([
      { panelCount: 4, kwp: 2, prices: { "pv-only": 36873, "me-5": 44556, "me-10": 46955, "me-16": 48889, "me-20": 53347, "me-23": 54077, "me-28": 56002 } },
      { panelCount: 5, kwp: 2.5, prices: { "pv-only": 37613, "me-5": 45296, "me-10": 47695, "me-16": 49629, "me-20": 54087, "me-23": 54817, "me-28": 56742 } },
      { panelCount: 6, kwp: 3, prices: { "pv-only": 38353, "me-5": 46036, "me-10": 48435, "me-16": 50369, "me-20": 54827, "me-23": 55557, "me-28": 57482 } },
      { panelCount: 7, kwp: 3.5, prices: { "pv-only": 39093, "me-5": 46776, "me-10": 49175, "me-16": 51109, "me-20": 55567, "me-23": 56297, "me-28": 58222 } },
      { panelCount: 8, kwp: 4, prices: { "pv-only": 39833, "me-5": 47516, "me-10": 49915, "me-16": 51849, "me-20": 56307, "me-23": 57037, "me-28": 58962 } },
      { panelCount: 9, kwp: 4.5, prices: { "pv-only": 40573, "me-5": 48256, "me-10": 50655, "me-16": 52589, "me-20": 57047, "me-23": 57777, "me-28": 59702 } },
      { panelCount: 10, kwp: 5, prices: { "pv-only": 41313, "me-5": 48996, "me-10": 51395, "me-16": 53329, "me-20": 57787, "me-23": 58517, "me-28": 60442 } },
      { panelCount: 11, kwp: 5.5, prices: { "pv-only": 43477, "me-5": 51160, "me-10": 53559, "me-16": 55493, "me-20": 59951, "me-23": 60681, "me-28": 62606 } },
      { panelCount: 12, kwp: 6, prices: { "pv-only": 44217, "me-5": 51900, "me-10": 54299, "me-16": 56233, "me-20": 60691, "me-23": 61421, "me-28": 63346 } },
      { panelCount: 13, kwp: 6.5, prices: { "pv-only": 46137, "me-5": 53820, "me-10": 56219, "me-16": 58153, "me-20": 62611, "me-23": 63341, "me-28": 65266 } },
      { panelCount: 14, kwp: 7, prices: { "pv-only": 46877, "me-5": 54560, "me-10": 56959, "me-16": 58893, "me-20": 63351, "me-23": 64081, "me-28": 66006 } },
      { panelCount: 15, kwp: 7.5, prices: { "pv-only": 47617, "me-5": 55300, "me-10": 57699, "me-16": 59633, "me-20": 64091, "me-23": 64821, "me-28": 66746 } },
      { panelCount: 16, kwp: 8, prices: { "pv-only": 48357, "me-5": 56040, "me-10": 58439, "me-16": 60373, "me-20": 64831, "me-23": 65561, "me-28": 67486 } },
      { panelCount: 17, kwp: 8.5, prices: { "pv-only": 49097, "me-5": 56780, "me-10": 59179, "me-16": 61113, "me-20": 65571, "me-23": 66301, "me-28": 68226 } },
      { panelCount: 18, kwp: 9, prices: { "pv-only": 49837, "me-5": 57520, "me-10": 59919, "me-16": 61853, "me-20": 66311, "me-23": 67041, "me-28": 68966 } },
      { panelCount: 19, kwp: 9.5, prices: { "pv-only": 50897, "me-5": 58580, "me-10": 60979, "me-16": 62913, "me-20": 67371, "me-23": 68101, "me-28": 70026 } },
      { panelCount: 20, kwp: 10, prices: { "pv-only": 51637, "me-5": 59320, "me-10": 61719, "me-16": 63653, "me-20": 68111, "me-23": 68841, "me-28": 70766 } },
      { panelCount: 21, kwp: 10.5, prices: { "pv-only": 52377, "me-5": 60060, "me-10": 62459, "me-16": 64393, "me-20": 68851, "me-23": 69581, "me-28": 71506 } }
    ]);
    expect(PRICE_ROWS.at(-1)).toEqual({
      panelCount: 40,
      kwp: 20,
      prices: { "pv-only": 66437, "me-5": 74120, "me-10": 76519, "me-16": 78453, "me-20": 82911, "me-23": 83641, "me-28": 85566 }
    });
  });
});
