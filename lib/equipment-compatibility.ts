import type { CompatibilityVerdict, EquipmentKind } from "@/lib/types";

export type EquipmentRecord = {
  id: string;
  brand: string;
  model: string;
  kind: EquipmentKind;
  aliases: string[];
  phase: "one_phase" | "three_phase" | "unknown";
  batteryVoltage: "lv_48v" | "hv" | "none" | "unknown";
  protocols: string[];
  notes: string;
  sourceUrl: string;
};

export type CompatibilityRecord = {
  inverterId: string;
  batteryId: string;
  verdict: CompatibilityVerdict;
  reason: string;
  firmwareNote?: string;
  sourceUrl: string;
};

export type CompatibilityAnswer = {
  verdict: CompatibilityVerdict;
  title: string;
  summary: string;
  reasons: string[];
  missing: string[];
  sourceUrls: string[];
};

export const equipmentRecords: EquipmentRecord[] = [
  {
    id: "deye-sg04lp3",
    brand: "Deye",
    model: "SUN-5/6/8/10/12K-SG04LP3-EU",
    kind: "inverter",
    aliases: ["deye 10kw", "deye 8kw", "sg04lp3", "sun-10k-sg04lp3", "hybrydowy deye"],
    phase: "three_phase",
    batteryVoltage: "lv_48v",
    protocols: ["CAN", "RS485", "Pylontech protocol"],
    notes: "Popularny niskonapięciowy falownik hybrydowy 3F. Weryfikować dokładny wariant i firmware.",
    sourceUrl: "https://www.deyeinverter.com/"
  },
  {
    id: "deye-sg01hp3",
    brand: "Deye",
    model: "SUN-5/6/8/10/12K-SG01HP3-EU",
    kind: "inverter",
    aliases: ["deye hv", "sg01hp3", "sun-10k-sg01hp3"],
    phase: "three_phase",
    batteryVoltage: "hv",
    protocols: ["CAN"],
    notes: "Wariant wysokiego napięcia. Nie mieszać z magazynami 48 V.",
    sourceUrl: "https://www.deyeinverter.com/"
  },
  {
    id: "goodwe-et-plus",
    brand: "GoodWe",
    model: "ET Plus+ GW5K-10K-ET",
    kind: "inverter",
    aliases: ["goodwe et", "gw10kn-et", "goodwe 10kw", "goodwee 10kw", "goodwe hybrydowy"],
    phase: "three_phase",
    batteryVoltage: "hv",
    protocols: ["CAN"],
    notes: "Seria HV. Najpierw sprawdzać oficjalny GoodWe Battery Compatibility Overview dla dokładnego modelu baterii.",
    sourceUrl: "https://en.goodwe.com/Ftp/EN/Downloads/User%20Manual/GW_Battery%20Compatibility%20Overview-PL.pdf"
  },
  {
    id: "sofar-hyd-ktl",
    brand: "Sofar",
    model: "HYD 5-20KTL-3PH",
    kind: "inverter",
    aliases: ["sofar hyd", "hyd 10ktl", "sofar 10kw"],
    phase: "three_phase",
    batteryVoltage: "hv",
    protocols: ["CAN", "Sofar protocol"],
    notes: "Falownik HV. Kompatybilność zależy od listy producenta i profilu baterii.",
    sourceUrl: "https://www.sofarsolar.com/"
  },
  {
    id: "huawei-m1",
    brand: "Huawei",
    model: "SUN2000-3/4/5/6/8/10KTL-M1",
    kind: "inverter",
    aliases: ["huawei m1", "sun2000", "huawei 10ktl", "huawei 10kw"],
    phase: "three_phase",
    batteryVoltage: "hv",
    protocols: ["Huawei ecosystem"],
    notes: "Zwykle pracuje z własnym ekosystemem Huawei LUNA. Nie zakładać kompatybilności z obcymi bateriami.",
    sourceUrl: "https://solar.huawei.com/"
  },
  {
    id: "fronius-gen24",
    brand: "Fronius",
    model: "Symo GEN24 Plus",
    kind: "inverter",
    aliases: ["fronius gen24", "symo gen24"],
    phase: "three_phase",
    batteryVoltage: "hv",
    protocols: ["BYD HVS/HVM"],
    notes: "Najczęściej parowany z BYD Battery-Box Premium HVS/HVM.",
    sourceUrl: "https://www.fronius.com/"
  },
  {
    id: "kon-tec-me",
    brand: "Kon-TEC",
    model: "ME 5.12/10.24/16/20 kWh",
    kind: "battery",
    aliases: ["kontec", "kon-tec", "kon tec", "me 10", "me 10.24"],
    phase: "unknown",
    batteryVoltage: "lv_48v",
    protocols: ["CAN", "RS485", "Pylontech-like profiles"],
    notes: "Magazyn LV 48 V. Przed montażem potwierdzić profil komunikacji i firmware u dystrybutora.",
    sourceUrl: "https://kon-tec.eu/"
  },
  {
    id: "felicity-lpba",
    brand: "Felicity",
    model: "LPBA/LPBF 48 V",
    kind: "battery",
    aliases: ["felicity", "felicity 23.5", "felicity 28", "lpba", "lpbf"],
    phase: "unknown",
    batteryVoltage: "lv_48v",
    protocols: ["CAN", "RS485", "Pylontech-like profiles"],
    notes: "Magazyn LV 48 V. Weryfikować dokładny model, BMS i profil komunikacji.",
    sourceUrl: "https://www.felicitysolar.com/"
  },
  {
    id: "deye-se-g5",
    brand: "Deye",
    model: "SE-G5.1 Pro-B",
    kind: "battery",
    aliases: ["deye bateria", "deye 5.1", "se-g5", "se g5"],
    phase: "unknown",
    batteryVoltage: "lv_48v",
    protocols: ["CAN", "RS485"],
    notes: "Naturalny wybór do falowników Deye LV, ale nadal wymaga zgodności modelu i ustawień.",
    sourceUrl: "https://www.deyeess.com/"
  },
  {
    id: "byd-hvm",
    brand: "BYD",
    model: "Battery-Box Premium HVM/HVS",
    kind: "battery",
    aliases: ["byd hvm", "byd hvs", "battery-box", "byd battery"],
    phase: "unknown",
    batteryVoltage: "hv",
    protocols: ["CAN"],
    notes: "Częsty magazyn HV dla GoodWe/Fronius/SMA. Dobór zależy od serii falownika.",
    sourceUrl: "https://www.bydbatterybox.com/"
  },
  {
    id: "pylontech-force",
    brand: "Pylontech",
    model: "Force H1/H2/H3",
    kind: "battery",
    aliases: ["pylontech force", "force h1", "force h2", "force h3"],
    phase: "unknown",
    batteryVoltage: "hv",
    protocols: ["CAN"],
    notes: "HV. Sprawdzać listę Pylontech ESS Compatibility i minimalny firmware.",
    sourceUrl: "https://enertik.com/cl/wp-content/uploads/sites/3/pylontech_lista_de_compatibilidad_v2.22_ess.pdf"
  }
];

export const compatibilityRules: CompatibilityRecord[] = [
  {
    inverterId: "deye-sg04lp3",
    batteryId: "kon-tec-me",
    verdict: "conditional",
    reason: "Oba urządzenia są w klasie LV 48 V i zwykle używają CAN/RS485, ale trzeba potwierdzić profil BMS dla konkretnego modelu Kon-TEC.",
    firmwareNote: "Przed ofertą sprawdzić ustawienia baterii w menu Deye i profil komunikacji z dystrybutorem.",
    sourceUrl: "https://kon-tec.eu/"
  },
  {
    inverterId: "deye-sg04lp3",
    batteryId: "felicity-lpba",
    verdict: "conditional",
    reason: "Napięcie i typ komunikacji są zgodne kierunkowo, ale Felicity ma wiele wariantów BMS. Wymagany dokładny model.",
    firmwareNote: "Weryfikować wersję BMS i czy działa profil Pylontech/Deye.",
    sourceUrl: "https://www.felicitysolar.com/"
  },
  {
    inverterId: "deye-sg04lp3",
    batteryId: "deye-se-g5",
    verdict: "compatible",
    reason: "To natywny kierunek Deye LV: falownik i magazyn pracują w tej samej klasie napięcia i ekosystemie.",
    sourceUrl: "https://www.deyeess.com/"
  },
  {
    inverterId: "deye-sg01hp3",
    batteryId: "kon-tec-me",
    verdict: "not_compatible",
    reason: "Falownik SG01HP3 jest HV, a Kon-TEC ME w tej bazie jest magazynem LV 48 V.",
    sourceUrl: "https://kon-tec.eu/"
  },
  {
    inverterId: "deye-sg01hp3",
    batteryId: "felicity-lpba",
    verdict: "not_compatible",
    reason: "Falownik HV nie powinien być dobierany do magazynu LV 48 V.",
    sourceUrl: "https://www.felicitysolar.com/"
  },
  {
    inverterId: "goodwe-et-plus",
    batteryId: "byd-hvm",
    verdict: "compatible",
    reason: "GoodWe ET Plus+ i BYD Battery-Box Premium HVM/HVS są opisane w oficjalnych zestawieniach kompatybilności GoodWe.",
    firmwareNote: "Sprawdzić dokładny numer serii ET i aktualny GoodWe Battery Compatibility Overview.",
    sourceUrl: "https://en.goodwe.com/Ftp/EN/Downloads/User%20Manual/GW_Battery%20Compatibility%20Overview-PL.pdf"
  },
  {
    inverterId: "goodwe-et-plus",
    batteryId: "kon-tec-me",
    verdict: "not_compatible",
    reason: "GoodWe ET Plus+ jest falownikiem HV, a Kon-TEC ME z tej bazy jest magazynem LV 48 V.",
    sourceUrl: "https://en.goodwe.com/Ftp/EN/Downloads/User%20Manual/GW_Battery%20Compatibility%20Overview-PL.pdf"
  },
  {
    inverterId: "goodwe-et-plus",
    batteryId: "felicity-lpba",
    verdict: "not_compatible",
    reason: "GoodWe ET Plus+ wymaga magazynu HV, a wskazany Felicity LPBA/LPBF jest LV 48 V.",
    sourceUrl: "https://en.goodwe.com/Ftp/EN/Downloads/User%20Manual/GW_Battery%20Compatibility%20Overview-PL.pdf"
  },
  {
    inverterId: "fronius-gen24",
    batteryId: "byd-hvm",
    verdict: "compatible",
    reason: "Fronius GEN24 Plus jest typowo integrowany z BYD Battery-Box Premium HVS/HVM.",
    sourceUrl: "https://www.fronius.com/"
  },
  {
    inverterId: "huawei-m1",
    batteryId: "kon-tec-me",
    verdict: "not_compatible",
    reason: "Huawei M1 jest projektowany pod ekosystem Huawei LUNA HV; nie zakładać pracy z Kon-TEC LV.",
    sourceUrl: "https://solar.huawei.com/"
  }
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findEquipment(query: string, kind?: EquipmentKind) {
  const normalized = normalize(query);
  if (!normalized) return null;

  return (
    equipmentRecords.find((item) => {
      if (kind && item.kind !== kind) return false;
      const haystack = normalize([item.brand, item.model, ...item.aliases].join(" "));
      return haystack.includes(normalized) || normalized.includes(normalize(item.brand));
    }) || null
  );
}

export function answerCompatibilityQuestion(question: string): CompatibilityAnswer {
  const inverter = findEquipment(question, "inverter");
  const battery =
    equipmentRecords.find((item) => item.kind === "battery" && normalize(question).includes(normalize(item.brand))) ||
    equipmentRecords.find((item) => item.kind === "battery" && item.aliases.some((alias) => normalize(question).includes(normalize(alias)))) ||
    null;

  const missing = [
    !inverter ? "dokładny model falownika" : "",
    !battery ? "dokładny model magazynu energii" : ""
  ].filter(Boolean);

  if (!inverter || !battery) {
    return {
      verdict: "unknown",
      title: "Potrzebuję dokładniejszych danych",
      summary: "Nie rozpoznaję pełnej pary sprzętu. Podaj producenta, model i czy magazyn jest LV 48 V czy HV.",
      reasons: [
        "Nie zgaduję kompatybilności po samej marce.",
        "Do decyzji potrzebny jest dokładny model falownika, typ magazynu, napięcie i komunikacja BMS."
      ],
      missing,
      sourceUrls: []
    };
  }

  const rule = compatibilityRules.find(
    (item) => item.inverterId === inverter.id && item.batteryId === battery.id
  );

  if (!rule) {
    const voltageMismatch =
      inverter.batteryVoltage !== "unknown" &&
      battery.batteryVoltage !== "unknown" &&
      inverter.batteryVoltage !== battery.batteryVoltage;

    return {
      verdict: voltageMismatch ? "not_compatible" : "unknown",
      title: voltageMismatch ? "Raczej nie podejdzie" : "Brak pewnej reguły w bazie",
      summary: voltageMismatch
        ? `${inverter.brand} ${inverter.model} i ${battery.brand} ${battery.model} mają inną klasę napięcia baterii.`
        : "Nie mam jeszcze oficjalnej reguły dla tej pary. Trzeba sprawdzić PDF producenta lub dystrybutora.",
      reasons: [
        `Falownik: ${inverter.brand} ${inverter.model}, bateria: ${battery.brand} ${battery.model}.`,
        `Napięcie falownika: ${inverter.batteryVoltage}, napięcie baterii: ${battery.batteryVoltage}.`,
        "CRM może zapisać to jako pytanie do weryfikacji technicznej."
      ],
      missing: voltageMismatch ? [] : ["oficjalna lista kompatybilności dla tej dokładnej pary"],
      sourceUrls: [inverter.sourceUrl, battery.sourceUrl]
    };
  }

  const title = {
    compatible: "Tak, to jest zgodna para",
    conditional: "Może podejść, ale wymaga potwierdzenia",
    unknown: "Brak pewnej decyzji",
    not_compatible: "Nie dobierałbym tej pary"
  }[rule.verdict];

  return {
    verdict: rule.verdict,
    title,
    summary: rule.reason,
    reasons: [
      `Falownik: ${inverter.brand} ${inverter.model}.`,
      `Magazyn: ${battery.brand} ${battery.model}.`,
      `Komunikacja falownika: ${inverter.protocols.join(", ") || "brak danych"}.`,
      `Komunikacja magazynu: ${battery.protocols.join(", ") || "brak danych"}.`,
      ...(rule.firmwareNote ? [rule.firmwareNote] : [])
    ],
    missing: rule.verdict === "conditional" ? ["dokładny model", "wersja BMS/firmware", "potwierdzenie dystrybutora"] : [],
    sourceUrls: Array.from(new Set([rule.sourceUrl, inverter.sourceUrl, battery.sourceUrl].filter(Boolean)))
  };
}
