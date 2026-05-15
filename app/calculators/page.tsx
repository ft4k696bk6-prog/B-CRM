"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  BatteryCharging,
  Calculator,
  FileText,
  Percent,
  Printer,
  Settings2,
  Zap
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { ProductVisual } from "@/components/product-visual";
import {
  DEFAULT_ADMIN_MARGIN_NET,
  DEFAULT_SALES_MARGIN_NET,
  EXTRA_NET_PRICES,
  INCLUDED_TOTAL_MARGIN_NET,
  PACKAGE_OPTIONS,
  PRICE_ROWS,
  type PackageId,
  recommendedInverter
} from "@/lib/pricing";
import { useAuth } from "@/lib/use-auth";

type VatRate = 8 | 23;
type CalculatorTab = "profitability" | "offer";

const formatMoney = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0
});

const formatNumber = new Intl.NumberFormat("pl-PL", {
  maximumFractionDigits: 1
});

function gross(value: number, vatRate: VatRate) {
  return value * (1 + vatRate / 100);
}

function simpleInstallment(amount: number, months: number, annualRatePercent: number) {
  if (months <= 0) return 0;
  const interest = amount * ((months / 12) * (annualRatePercent / 100));
  return (amount + interest) / months;
}

export default function CalculatorsPage() {
  const { loading, profile } = useAuth();
  const [tab, setTab] = useState<CalculatorTab>("offer");
  const [vatRate, setVatRate] = useState<VatRate>(8);

  const [bill, setBill] = useState(420);
  const [annualConsumption, setAnnualConsumption] = useState(5000);
  const [energyPrice, setEnergyPrice] = useState(1);
  const [systemKw, setSystemKw] = useState(5.5);
  const [productionPerKw, setProductionPerKw] = useState(1000);
  const [selfConsumption, setSelfConsumption] = useState(35);
  const [storageKwh, setStorageKwh] = useState(10.24);
  const [annualGrowth, setAnnualGrowth] = useState(15);

  const [selectedRowIndex, setSelectedRowIndex] = useState(7);
  const [selectedPackage, setSelectedPackage] = useState<PackageId>("me-10");
  const selectedPackageInfo =
    PACKAGE_OPTIONS.find((item) => item.id === selectedPackage) || PACKAGE_OPTIONS[0];
  const [storageBrand, setStorageBrand] = useState(selectedPackageInfo.brands[0]);
  const [adminMargin, setAdminMargin] = useState(DEFAULT_ADMIN_MARGIN_NET);
  const [salesMargin, setSalesMargin] = useState(DEFAULT_SALES_MARGIN_NET);
  const [groundMount, setGroundMount] = useState(false);
  const [triangles, setTriangles] = useState(false);
  const [boiler, setBoiler] = useState<"none" | "80" | "150">("none");
  const [backup, setBackup] = useState(false);
  const [extraCableMeters, setExtraCableMeters] = useState(0);
  const [manualAdjustment, setManualAdjustment] = useState(0);
  const [subsidy, setSubsidy] = useState(0);
  const [loanMonths, setLoanMonths] = useState(120);
  const [loanRate, setLoanRate] = useState(6);

  const isAdmin = profile?.role === "admin";

  const profitability = useMemo(() => {
    const annualProduction = systemKw * productionPerKw;
    const storageBoost = Math.min(storageKwh * 2.2, 24);
    const effectiveSelfConsumption = Math.min(selfConsumption + storageBoost, 92);
    const selfUsedEnergy = Math.min(annualProduction, annualConsumption) * (effectiveSelfConsumption / 100);
    const exportedEnergy = Math.max(annualProduction - selfUsedEnergy, 0);
    const directSavings = selfUsedEnergy * energyPrice;
    const exportValue = exportedEnergy * energyPrice * 0.45;
    const annualSavings = directSavings + exportValue;

    let cumulativeEnergySpend = 0;
    let currentYearSpend = bill * 12;
    for (let year = 0; year < 10; year += 1) {
      cumulativeEnergySpend += currentYearSpend;
      currentYearSpend *= 1 + annualGrowth / 100;
    }

    return {
      annualProduction,
      effectiveSelfConsumption,
      annualSavings,
      cumulativeEnergySpend,
      billCoverage: Math.min((annualSavings / (bill * 12)) * 100, 100)
    };
  }, [
    annualConsumption,
    annualGrowth,
    bill,
    energyPrice,
    productionPerKw,
    selfConsumption,
    storageKwh,
    systemKw
  ]);

  const offer = useMemo(() => {
    const row = PRICE_ROWS[selectedRowIndex] || PRICE_ROWS[0];
    const packageInfo = PACKAGE_OPTIONS.find((item) => item.id === selectedPackage) || PACKAGE_OPTIONS[0];
    const cennikNet = row.prices[selectedPackage];
    const baseNet = cennikNet - INCLUDED_TOTAL_MARGIN_NET;
    const extrasNet =
      (groundMount ? row.kwp * EXTRA_NET_PRICES.groundPerKw : 0) +
      (triangles ? row.kwp * EXTRA_NET_PRICES.ekierkiPerKw : 0) +
      (boiler === "80" ? EXTRA_NET_PRICES.boiler80 : 0) +
      (boiler === "150" ? EXTRA_NET_PRICES.boiler150 : 0) +
      (backup ? EXTRA_NET_PRICES.backup : 0) +
      extraCableMeters * EXTRA_NET_PRICES.cablePerMeterAbove8m +
      manualAdjustment;
    const finalNet = Math.max(baseNet + adminMargin + salesMargin + extrasNet, 0);
    const finalGross = gross(finalNet, vatRate);
    const creditAfterSubsidy = Math.max(finalGross - subsidy, 0);

    return {
      row,
      packageInfo,
      inverter: recommendedInverter(row.kwp),
      cennikNet,
      baseNet,
      extrasNet,
      finalNet,
      finalGross,
      installmentBeforeSubsidy: simpleInstallment(finalGross, loanMonths, loanRate),
      installmentAfterSubsidy: simpleInstallment(creditAfterSubsidy, loanMonths, loanRate),
      creditAfterSubsidy
    };
  }, [
    adminMargin,
    backup,
    boiler,
    extraCableMeters,
    groundMount,
    loanMonths,
    loanRate,
    manualAdjustment,
    salesMargin,
    selectedPackage,
    selectedRowIndex,
    subsidy,
    triangles,
    vatRate
  ]);

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="section-title">Kalkulatory</h1>
            <p className="mt-1 text-sm text-muted">
              Cennik FINAL netto, marże admin/handlowiec, VAT oraz prosty abonament z pliku Excel.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-line bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setTab("offer")}
              className={`rounded-md px-4 py-2 text-sm font-bold transition ${
                tab === "offer" ? "bg-ink text-white" : "text-muted hover:bg-[#eef3f8]"
              }`}
            >
              Oferta
            </button>
            <button
              type="button"
              onClick={() => setTab("profitability")}
              className={`rounded-md px-4 py-2 text-sm font-bold transition ${
                tab === "profitability" ? "bg-ink text-white" : "text-muted hover:bg-[#eef3f8]"
              }`}
            >
              Opłacalność
            </button>
          </div>
        </div>

        <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-ink">Stawka VAT</h2>
              <p className="mt-1 text-sm text-muted">Ceny z cennika są netto. CRM dolicza VAT 8% albo 23%.</p>
            </div>
            <div className="inline-flex rounded-lg border border-line bg-[#f9fbfd] p-1">
              {[8, 23].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setVatRate(rate as VatRate)}
                  className={`rounded-md px-5 py-2 text-sm font-black transition ${
                    vatRate === rate ? "bg-solar text-[#5a3900]" : "text-muted hover:bg-white"
                  }`}
                >
                  VAT {rate}%
                </button>
              ))}
            </div>
          </div>
        </section>

        {tab === "offer" ? (
          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-5">
              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky/10 text-sky">
                    <Calculator className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="text-base font-bold text-ink">Konfiguracja z cennika</h2>
                </div>

                <div className="grid gap-4">
                  <label>
                    <span className="label">Moc / liczba modułów JA Solar 500 W</span>
                    <select
                      className="field"
                      value={selectedRowIndex}
                      onChange={(event) => {
                        const index = Number(event.target.value);
                        setSelectedRowIndex(index);
                        setSystemKw(PRICE_ROWS[index]?.kwp || systemKw);
                      }}
                    >
                      {PRICE_ROWS.map((row, index) => (
                        <option key={row.panelCount} value={index}>
                          {row.panelCount} modułów · {row.kwp} kWp
                        </option>
                      ))}
                    </select>
                  </label>

                  <div>
                    <span className="label">Wariant</span>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {PACKAGE_OPTIONS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedPackage(item.id);
                            setStorageBrand(item.brands[0]);
                            setStorageKwh(item.storageKwh);
                          }}
                          className={`min-h-20 rounded-lg border p-3 text-left transition ${
                            selectedPackage === item.id
                              ? "border-ink bg-ink text-white"
                              : "border-line bg-[#f9fbfd] text-ink hover:border-ink"
                          }`}
                        >
                          <span className="block text-sm font-black">{item.shortLabel}</span>
                          <span className="mt-1 block text-xs opacity-80">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedPackageInfo.storageKwh > 0 ? (
                    <label>
                      <span className="label">Marka magazynu</span>
                      <select
                        className="field"
                        value={storageBrand}
                        onChange={(event) => setStorageBrand(event.target.value)}
                      >
                        {selectedPackageInfo.brands.map((brand) => (
                          <option key={brand} value={brand}>
                            {brand}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              </section>

              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-solar/20 text-[#8a5a00]">
                    <Settings2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="text-base font-bold text-ink">Marże i dodatki netto</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="label">Marża admina netto</span>
                    <input
                      className="field"
                      type="number"
                      value={adminMargin}
                      disabled={!isAdmin}
                      onChange={(event) => setAdminMargin(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span className="label">Marża handlowca netto</span>
                    <input
                      className="field"
                      type="number"
                      value={salesMargin}
                      min={0}
                      onChange={(event) => setSalesMargin(Number(event.target.value))}
                    />
                  </label>

                  <label className="flex items-center gap-3 rounded-md border border-line bg-[#f9fbfd] p-3 text-sm font-semibold">
                    <input type="checkbox" checked={groundMount} onChange={(event) => setGroundMount(event.target.checked)} />
                    Grunt +{EXTRA_NET_PRICES.groundPerKw} zł/kW
                  </label>
                  <label className="flex items-center gap-3 rounded-md border border-line bg-[#f9fbfd] p-3 text-sm font-semibold">
                    <input type="checkbox" checked={triangles} onChange={(event) => setTriangles(event.target.checked)} />
                    Ekierki +{EXTRA_NET_PRICES.ekierkiPerKw} zł/kW
                  </label>
                  <label>
                    <span className="label">Bojler</span>
                    <select className="field" value={boiler} onChange={(event) => setBoiler(event.target.value as "none" | "80" | "150")}>
                      <option value="none">Bez bojlera</option>
                      <option value="80">Bojler 80L +{EXTRA_NET_PRICES.boiler80} zł</option>
                      <option value="150">Bojler 150L +{EXTRA_NET_PRICES.boiler150} zł</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-3 rounded-md border border-line bg-[#f9fbfd] p-3 text-sm font-semibold">
                    <input type="checkbox" checked={backup} onChange={(event) => setBackup(event.target.checked)} />
                    Backup +{EXTRA_NET_PRICES.backup} zł
                  </label>
                  <label>
                    <span className="label">Kabel powyżej 8 m</span>
                    <input
                      className="field"
                      type="number"
                      value={extraCableMeters}
                      min={0}
                      onChange={(event) => setExtraCableMeters(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span className="label">Korekta ręczna netto</span>
                    <input
                      className="field"
                      type="number"
                      value={manualAdjustment}
                      onChange={(event) => setManualAdjustment(Number(event.target.value))}
                    />
                  </label>
                </div>

                {!isAdmin ? (
                  <p className="mt-3 rounded-md border border-solar/30 bg-solar/10 p-3 text-sm text-[#6f4900]">
                    Handlowiec zmienia swoją marżę. Marża admina jest widoczna informacyjnie.
                  </p>
                ) : null}
              </section>

              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                    <Banknote className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="text-base font-bold text-ink">Abonament i dotacja</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label>
                    <span className="label">Dotacja / wpłata</span>
                    <input className="field" type="number" value={subsidy} onChange={(event) => setSubsidy(Number(event.target.value))} />
                  </label>
                  <label>
                    <span className="label">Liczba miesięcy</span>
                    <input className="field" type="number" value={loanMonths} onChange={(event) => setLoanMonths(Number(event.target.value))} />
                  </label>
                  <label>
                    <span className="label">Oprocentowanie roczne %</span>
                    <input className="field" type="number" step="0.1" value={loanRate} onChange={(event) => setLoanRate(Number(event.target.value))} />
                  </label>
                </div>
              </section>
            </div>

            <aside className="grid gap-5">
              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-ink">Podsumowanie oferty</h2>
                    <p className="mt-1 text-sm text-muted">Cennik netto + marże + VAT.</p>
                  </div>
                  <button type="button" onClick={() => window.print()} className="btn-secondary">
                    <Printer className="h-4 w-4" aria-hidden="true" />
                    Drukuj
                  </button>
                </div>

                <div className="rounded-lg border border-leaf/20 bg-leaf/10 p-4">
                  <div className="text-sm font-semibold text-[#23682e]">Cena brutto dla klienta</div>
                  <div className="mt-2 text-3xl font-black text-[#23682e]">
                    {formatMoney.format(offer.finalGross)}
                  </div>
                  <div className="mt-2 text-sm text-[#23682e]">
                    Rata przed dotacją:{" "}
                    <span className="font-black">{formatMoney.format(offer.installmentBeforeSubsidy)}</span>
                  </div>
                  <div className="text-sm text-[#23682e]">
                    Rata po dotacji:{" "}
                    <span className="font-black">{formatMoney.format(offer.installmentAfterSubsidy)}</span>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3">
                  <OfferRow label="Wariant" value={offer.packageInfo.label} />
                  <OfferRow label="Moduły" value={`${offer.row.panelCount} x JA Solar 500 W`} />
                  <OfferRow label="Moc" value={`${formatNumber.format(offer.row.kwp)} kWp`} />
                  <OfferRow label="Falownik" value={offer.inverter.label} />
                  <OfferRow label="Magazyn" value={offer.packageInfo.storageKwh ? `${storageBrand} ${offer.packageInfo.shortLabel}` : "Brak"} />
                  <OfferRow label="Cena z cennika netto" value={formatMoney.format(offer.cennikNet)} />
                  <OfferRow label="Baza netto bez 15k marży" value={formatMoney.format(offer.baseNet)} />
                  <OfferRow label="Marża admina" value={formatMoney.format(adminMargin)} />
                  <OfferRow label="Marża handlowca" value={formatMoney.format(salesMargin)} />
                  <OfferRow label="Dodatki / korekty netto" value={formatMoney.format(offer.extrasNet)} />
                  <OfferRow label="Cena netto finalna" value={formatMoney.format(offer.finalNet)} />
                  <OfferRow label="VAT" value={`${vatRate}%`} />
                  <OfferRow label="Kwota kredytu po dotacji" value={formatMoney.format(offer.creditAfterSubsidy)} />
                </dl>
              </section>

              <section className="grid gap-3">
                <ProductVisual type="panel" title="JA Solar 500 W" subtitle={`${offer.row.panelCount} modułów · ${offer.row.kwp} kWp`} />
                <ProductVisual type="inverter" title="Deye hybrid LV" subtitle={offer.inverter.label.replace("Deye hybrydowy niskonapięciowy ", "")} />
                <ProductVisual
                  type="battery"
                  title={offer.packageInfo.storageKwh ? storageBrand : "Bez magazynu"}
                  subtitle={offer.packageInfo.storageKwh ? offer.packageInfo.shortLabel : "wariant samo foto"}
                />
              </section>
            </aside>
          </section>
        ) : (
          <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-solar/20 text-[#8a5a00]">
                  <Zap className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-bold text-ink">Dane klienta i instalacji</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField label="Rachunek miesięczny" value={bill} onChange={setBill} />
                <NumberField label="Zużycie roczne kWh" value={annualConsumption} onChange={setAnnualConsumption} />
                <NumberField label="Cena zakupu 1 kWh" value={energyPrice} step="0.01" onChange={setEnergyPrice} />
                <NumberField label="Moc instalacji kWp" value={systemKw} step="0.1" onChange={setSystemKw} />
                <NumberField label="Produkcja z 1 kWp" value={productionPerKw} onChange={setProductionPerKw} />
                <NumberField label="Autokonsumpcja %" value={selfConsumption} onChange={setSelfConsumption} />
                <NumberField label="Magazyn energii kWh" value={storageKwh} step="0.1" onChange={setStorageKwh} />
                <NumberField label="Roczny wzrost ceny %" value={annualGrowth} onChange={setAnnualGrowth} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ResultTile icon={Zap} label="Produkcja roczna" value={`${formatNumber.format(profitability.annualProduction)} kWh`} tone="solar" />
              <ResultTile icon={BatteryCharging} label="Autokonsumpcja po magazynie" value={`${formatNumber.format(profitability.effectiveSelfConsumption)}%`} tone="leaf" />
              <ResultTile icon={Banknote} label="Oszczędność roczna" value={formatMoney.format(profitability.annualSavings)} tone="sky" />
              <ResultTile icon={Percent} label="Pokrycie rachunków" value={`${formatNumber.format(profitability.billCoverage)}%`} tone="leaf" />
              <div className="sm:col-span-2 rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-muted">Prognozowany koszt prądu przez 10 lat</div>
                <div className="mt-2 text-3xl font-black text-ink">
                  {formatMoney.format(profitability.cumulativeEnergySpend)}
                </div>
                <div className="mt-2 text-sm text-muted">
                  Logika bazuje na prostym arkuszu: zużycie roczne, cena 1 kWh i roczny wzrost ceny.
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "1"
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input
        className="field"
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ResultTile({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  tone: "solar" | "leaf" | "sky";
}) {
  const tones = {
    solar: "bg-solar/20 text-[#8a5a00] border-solar/30",
    leaf: "bg-leaf/10 text-leaf border-leaf/20",
    sky: "bg-sky/10 text-sky border-sky/20"
  };

  return (
    <div className={`rounded-lg border bg-white p-5 shadow-sm ${tones[tone]}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
      <div className="mt-4 text-sm font-semibold opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

function OfferRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-line bg-[#f9fbfd] px-3 py-2 text-sm">
      <dt className="font-semibold text-muted">{label}</dt>
      <dd className="text-right font-bold text-ink">{value}</dd>
    </div>
  );
}

