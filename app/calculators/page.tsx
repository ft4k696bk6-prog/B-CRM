"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  BatteryCharging,
  Calculator,
  FileText,
  Minus,
  Percent,
  Plus,
  Printer,
  Umbrella,
  Zap
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { ProductVisual } from "@/components/product-visual";
import {
  EXTRA_NET_PRICES,
  INCLUDED_TOTAL_MARGIN_NET,
  INVERTER_NET_PRICES,
  PACKAGE_OPTIONS,
  PRICE_ROWS,
  STORAGE_NET_PRICES,
  type OfferMode,
  type PackageId,
  type RainwaterSystem,
  getPriceRowByPanelCount,
  recommendedInverter
} from "@/lib/pricing";
import { usePricingSettings } from "@/lib/pricing-settings";
import { useAuth } from "@/lib/use-auth";

type VatRate = 8 | 23;
type CalculatorTab = "offer" | "profitability";

const packageChoices = PACKAGE_OPTIONS.filter((item) => item.id !== "pv-only");
const minPanelCount = PRICE_ROWS[0].panelCount;
const maxPanelCount = PRICE_ROWS[PRICE_ROWS.length - 1].panelCount;

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

function clampPanelCount(value: number) {
  return Math.max(minPanelCount, Math.min(maxPanelCount, Math.round(value)));
}

export default function CalculatorsPage() {
  const { loading, profile } = useAuth();
  const { settings } = usePricingSettings(profile?.role);
  const [tab, setTab] = useState<CalculatorTab>("offer");
  const [vatRate, setVatRate] = useState<VatRate>(8);

  const [bill, setBill] = useState(420);
  const [annualConsumption, setAnnualConsumption] = useState(5000);
  const [energyPrice, setEnergyPrice] = useState(1);
  const [productionPerKw, setProductionPerKw] = useState(1000);
  const [annualGrowth, setAnnualGrowth] = useState(15);

  const [offerMode, setOfferMode] = useState<OfferMode>("pv-storage");
  const [panelCount, setPanelCount] = useState(11);
  const [selectedPackage, setSelectedPackage] = useState<PackageId>("me-10");
  const selectedPackageInfo =
    PACKAGE_OPTIONS.find((item) => item.id === selectedPackage) || packageChoices[1];
  const [storageBrand, setStorageBrand] = useState("Kon-TEC");
  const [storageProductId, setStorageProductId] = useState("kon-tec-10");
  const [inverterKw, setInverterKw] = useState(8);
  const [groundMount, setGroundMount] = useState(false);
  const [triangles, setTriangles] = useState(false);
  const [boiler, setBoiler] = useState<"none" | "80" | "150">("none");
  const [rainwater, setRainwater] = useState<RainwaterSystem>("none");
  const [backup, setBackup] = useState(false);
  const [extraCableMeters, setExtraCableMeters] = useState(0);
  const [manualAdjustment, setManualAdjustment] = useState(0);
  const [subsidy, setSubsidy] = useState(0);
  const [loanMonths, setLoanMonths] = useState(120);
  const [loanRate, setLoanRate] = useState(6);

  const row = getPriceRowByPanelCount(panelCount);
  const storageProduct = STORAGE_NET_PRICES.find((item) => item.id === storageProductId) || STORAGE_NET_PRICES[1];
  const inverter = offerMode === "storage"
    ? INVERTER_NET_PRICES.find((item) => item.kw === inverterKw) || INVERTER_NET_PRICES[1]
    : recommendedInverter(row.kwp);

  const currentStorageKwh =
    offerMode === "pv-storage" ? selectedPackageInfo.storageKwh : offerMode === "storage" ? storageProduct.kwh : 0;

  const profitability = useMemo(() => {
    const systemKw = row.kwp;
    const annualProduction = systemKw * productionPerKw;
    const effectiveSelfConsumption = currentStorageKwh > 0 ? 85 : 25;
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
    currentStorageKwh,
    energyPrice,
    productionPerKw,
    row.kwp
  ]);

  const offer = useMemo(() => {
    const cennikNet =
      offerMode === "storage"
        ? storageProduct.net + inverter.net
        : offerMode === "pv"
          ? row.prices["pv-only"]
          : row.prices[selectedPackage];
    const baseNet = Math.max(cennikNet - INCLUDED_TOTAL_MARGIN_NET, 0);
    const pvExtras =
      offerMode === "storage"
        ? 0
        : (groundMount ? row.kwp * EXTRA_NET_PRICES.groundPerKw : 0) +
          (triangles ? row.kwp * EXTRA_NET_PRICES.ekierkiPerKw : 0);
    const rainwaterNet =
      rainwater === "above-2000"
        ? EXTRA_NET_PRICES.rainwaterAbove2000
        : rainwater === "underground-2000"
          ? EXTRA_NET_PRICES.rainwaterUnderground2000
          : 0;
    const extrasNet =
      pvExtras +
      (boiler === "80" ? EXTRA_NET_PRICES.boiler80 : 0) +
      (boiler === "150" ? EXTRA_NET_PRICES.boiler150 : 0) +
      rainwaterNet +
      (backup ? EXTRA_NET_PRICES.backup : 0) +
      extraCableMeters * EXTRA_NET_PRICES.cablePerMeterAbove8m +
      manualAdjustment;
    const finalNet = Math.max(baseNet + settings.adminMargin + settings.salesMargin + extrasNet, 0);
    const finalGross = gross(finalNet, vatRate);
    const creditAfterSubsidy = Math.max(finalGross - subsidy, 0);

    return {
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
    backup,
    boiler,
    extraCableMeters,
    groundMount,
    inverter.net,
    loanMonths,
    loanRate,
    manualAdjustment,
    offerMode,
    rainwater,
    row,
    selectedPackage,
    settings.adminMargin,
    settings.salesMargin,
    storageProduct.net,
    subsidy,
    triangles,
    vatRate
  ]);

  if (loading || !profile) return <LoadingScreen />;

  const offerTitle =
    offerMode === "pv"
      ? "Instalacja fotowoltaiczna"
      : offerMode === "storage"
        ? "Magazyn energii"
        : "Fotowoltaika z magazynem energii";

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div className="no-print flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="section-title">Kalkulatory</h1>
            <p className="mt-1 text-sm text-muted">
              Przygotuj konfigurację, sprawdź ratę i wygeneruj ofertę dla klienta.
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

        <section className="no-print rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-ink">Stawka VAT</h2>
              <p className="mt-1 text-sm text-muted">Wybierz stawkę dla przygotowywanej oferty.</p>
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
          <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="no-print grid gap-5">
              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky/10 text-sky">
                    <Calculator className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="text-base font-bold text-ink">Konfiguracja</h2>
                </div>

                <div className="grid gap-4">
                  <div>
                    <span className="label">Wariant oferty</span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <OfferModeButton
                        active={offerMode === "pv"}
                        title="Samo PV"
                        subtitle="Instalacja fotowoltaiczna"
                        onClick={() => setOfferMode("pv")}
                      />
                      <OfferModeButton
                        active={offerMode === "pv-storage"}
                        title="PV + magazyn"
                        subtitle="Instalacja z magazynem"
                        onClick={() => setOfferMode("pv-storage")}
                      />
                      <OfferModeButton
                        active={offerMode === "storage"}
                        title="Sam magazyn"
                        subtitle="Magazyn + falownik"
                        onClick={() => setOfferMode("storage")}
                      />
                    </div>
                  </div>

                  {offerMode !== "storage" ? (
                    <div>
                      <span className="label">Liczba modułów JA Solar 500 W</span>
                      <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                        <button
                          type="button"
                          className="btn-secondary h-11"
                          onClick={() => setPanelCount((value) => clampPanelCount(value - 1))}
                        >
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <input
                          className="field text-center text-lg font-black"
                          type="number"
                          min={minPanelCount}
                          max={maxPanelCount}
                          value={panelCount}
                          onChange={(event) => setPanelCount(clampPanelCount(Number(event.target.value)))}
                        />
                        <button
                          type="button"
                          className="btn-secondary h-11"
                          onClick={() => setPanelCount((value) => clampPanelCount(value + 1))}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-muted">
                        {row.panelCount} modułów daje {formatNumber.format(row.kwp)} kWp.
                      </p>
                    </div>
                  ) : null}

                  {offerMode === "pv-storage" ? (
                    <>
                      <div>
                        <span className="label">Moc magazynu</span>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {packageChoices.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setSelectedPackage(item.id);
                                setStorageBrand(item.brands[0]);
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
                    </>
                  ) : null}

                  {offerMode === "storage" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label>
                        <span className="label">Magazyn energii</span>
                        <select
                          className="field"
                          value={storageProductId}
                          onChange={(event) => setStorageProductId(event.target.value)}
                        >
                          {STORAGE_NET_PRICES.map((storage) => (
                            <option key={storage.id} value={storage.id}>
                              {storage.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="label">Moc falownika</span>
                        <select
                          className="field"
                          value={inverterKw}
                          onChange={(event) => setInverterKw(Number(event.target.value))}
                        >
                          {INVERTER_NET_PRICES.map((item) => (
                            <option key={item.kw} value={item.kw}>
                              {item.kw} kW
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-solar/20 text-[#8a5a00]">
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="text-base font-bold text-ink">Dodatki</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {offerMode !== "storage" ? (
                    <>
                      <Toggle label={`Grunt +${EXTRA_NET_PRICES.groundPerKw} zł/kW`} checked={groundMount} onChange={setGroundMount} />
                      <Toggle label={`Ekierki +${EXTRA_NET_PRICES.ekierkiPerKw} zł/kW`} checked={triangles} onChange={setTriangles} />
                    </>
                  ) : null}

                  <label>
                    <span className="label">Bojler</span>
                    <select className="field" value={boiler} onChange={(event) => setBoiler(event.target.value as "none" | "80" | "150")}>
                      <option value="none">Bez bojlera</option>
                      <option value="80">Bojler 80L</option>
                      <option value="150">Bojler 150L</option>
                    </select>
                  </label>
                  <label>
                    <span className="label">System magazynowania deszczówki</span>
                    <select className="field" value={rainwater} onChange={(event) => setRainwater(event.target.value as RainwaterSystem)}>
                      <option value="none">Bez systemu</option>
                      <option value="above-2000">Naziemny 2000L</option>
                      <option value="underground-2000">Podziemny betonowy 2000L</option>
                    </select>
                  </label>
                  <Toggle label="Backup" checked={backup} onChange={setBackup} />
                  <NumberField label="Kabel powyżej 8 m" value={extraCableMeters} min={0} onChange={setExtraCableMeters} />
                  <NumberField label="Korekta ręczna" value={manualAdjustment} onChange={setManualAdjustment} />
                </div>
              </section>

              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                    <Banknote className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="text-base font-bold text-ink">Finansowanie</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <NumberField label="Dotacja / wpłata" value={subsidy} min={0} onChange={setSubsidy} />
                  <NumberField label="Liczba miesięcy" value={loanMonths} min={1} onChange={setLoanMonths} />
                  <NumberField label="Oprocentowanie roczne %" value={loanRate} step="0.1" min={0} onChange={setLoanRate} />
                </div>
              </section>
            </div>

            <aside className="grid gap-5">
              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-ink">Podsumowanie</h2>
                    <p className="mt-1 text-sm text-muted">Gotowe dane do rozmowy z klientem.</p>
                  </div>
                  <button type="button" onClick={() => window.print()} className="btn-secondary">
                    <Printer className="h-4 w-4" aria-hidden="true" />
                    PDF
                  </button>
                </div>

                <div className="rounded-lg border border-leaf/20 bg-leaf/10 p-4">
                  <div className="text-sm font-semibold text-[#23682e]">Cena brutto</div>
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
                  <OfferRow label="Wariant" value={offerTitle} />
                  {offerMode !== "storage" ? <OfferRow label="Moduły" value={`${row.panelCount} x JA Solar 500 W`} /> : null}
                  {offerMode !== "storage" ? <OfferRow label="Moc PV" value={`${formatNumber.format(row.kwp)} kWp`} /> : null}
                  <OfferRow label="Falownik" value={inverter.label} />
                  {offerMode === "pv-storage" ? (
                    <OfferRow label="Magazyn" value={`${storageBrand} ${selectedPackageInfo.shortLabel}`} />
                  ) : null}
                  {offerMode === "storage" ? <OfferRow label="Magazyn" value={storageProduct.label} /> : null}
                  {rainwater !== "none" ? (
                    <OfferRow
                      label="Deszczówka"
                      value={rainwater === "above-2000" ? "Naziemny 2000L" : "Podziemny betonowy 2000L"}
                    />
                  ) : null}
                  <OfferRow label="Cena netto" value={formatMoney.format(offer.finalNet)} />
                  <OfferRow label="VAT" value={`${vatRate}%`} />
                  <OfferRow label="Cena brutto" value={formatMoney.format(offer.finalGross)} />
                </dl>
              </section>

              <OfferDocument
                title={offerTitle}
                mode={offerMode}
                row={row}
                inverterLabel={inverter.label}
                storageLabel={
                  offerMode === "pv-storage"
                    ? `${storageBrand} ${selectedPackageInfo.shortLabel}`
                    : offerMode === "storage"
                      ? storageProduct.label
                      : "Nie dotyczy"
                }
                rainwaterLabel={
                  rainwater === "above-2000"
                    ? "Naziemny system magazynowania deszczówki 2000L"
                    : rainwater === "underground-2000"
                      ? "Podziemny betonowy system magazynowania deszczówki 2000L"
                      : ""
                }
                net={offer.finalNet}
                gross={offer.finalGross}
                subsidy={subsidy}
                installmentBefore={offer.installmentBeforeSubsidy}
                installmentAfter={offer.installmentAfterSubsidy}
              />
            </aside>
          </section>
        ) : (
          <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-solar/20 text-[#8a5a00]">
                  <Zap className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-bold text-ink">Dane klienta</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField label="Rachunek miesięczny" value={bill} min={0} onChange={setBill} />
                <NumberField label="Zużycie roczne kWh" value={annualConsumption} min={0} onChange={setAnnualConsumption} />
                <NumberField label="Cena zakupu 1 kWh" value={energyPrice} step="0.01" min={0} onChange={setEnergyPrice} />
                <NumberField label="Produkcja z 1 kWp" value={productionPerKw} min={0} onChange={setProductionPerKw} />
                <NumberField label="Roczny wzrost ceny %" value={annualGrowth} min={0} onChange={setAnnualGrowth} />
              </div>
              <p className="mt-4 rounded-md border border-sky/20 bg-sky/10 p-3 text-sm font-semibold text-sky">
                Autokonsumpcja przyjęta do symulacji: {profitability.effectiveSelfConsumption}%.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ResultTile icon={Zap} label="Produkcja roczna" value={`${formatNumber.format(profitability.annualProduction)} kWh`} tone="solar" />
              <ResultTile icon={BatteryCharging} label="Autokonsumpcja" value={`${formatNumber.format(profitability.effectiveSelfConsumption)}%`} tone="leaf" />
              <ResultTile icon={Banknote} label="Oszczędność roczna" value={formatMoney.format(profitability.annualSavings)} tone="sky" />
              <ResultTile icon={Percent} label="Pokrycie rachunków" value={`${formatNumber.format(profitability.billCoverage)}%`} tone="leaf" />
              <div className="sm:col-span-2 rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-muted">Prognozowany koszt prądu przez 10 lat</div>
                <div className="mt-2 text-3xl font-black text-ink">
                  {formatMoney.format(profitability.cumulativeEnergySpend)}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function OfferModeButton({
  active,
  title,
  subtitle,
  onClick
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-24 rounded-lg border p-4 text-left transition ${
        active ? "border-ink bg-ink text-white" : "border-line bg-[#f9fbfd] text-ink hover:border-ink"
      }`}
    >
      <span className="block text-base font-black">{title}</span>
      <span className="mt-1 block text-xs opacity-80">{subtitle}</span>
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "1",
  min
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
  min?: number;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input
        className="field"
        type="number"
        step={step}
        min={min}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-line bg-[#f9fbfd] p-3 text-sm font-semibold">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
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

function OfferDocument({
  title,
  mode,
  row,
  inverterLabel,
  storageLabel,
  rainwaterLabel,
  net,
  gross,
  subsidy,
  installmentBefore,
  installmentAfter
}: {
  title: string;
  mode: OfferMode;
  row: { panelCount: number; kwp: number };
  inverterLabel: string;
  storageLabel: string;
  rainwaterLabel: string;
  net: number;
  gross: number;
  subsidy: number;
  installmentBefore: number;
  installmentAfter: number;
}) {
  return (
    <section className="offer-document rounded-lg border border-line bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-solar">Re-Energy System</div>
          <h2 className="mt-2 text-2xl font-black text-ink">Oferta</h2>
          <p className="mt-1 text-sm text-muted">Energia ze słońca i wiatru</p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>ul. Kowalska 5/203, 20-115 Lublin</div>
          <div>biuro@re-energysystem.pl</div>
          <div>+48 729 796 441</div>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="rounded-lg bg-ink p-5 text-white">
          <div className="text-sm font-semibold text-white/70">Przygotowana oferta</div>
          <div className="mt-1 text-2xl font-black">{title}</div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {mode !== "storage" ? (
            <ProductVisual type="panel" title="JA Solar 500 W" subtitle={`${row.panelCount} modułów · ${formatNumber.format(row.kwp)} kWp`} />
          ) : null}
          <ProductVisual type="inverter" title="Deye hybrid LV" subtitle={inverterLabel.replace("Deye hybrydowy niskonapięciowy ", "")} />
          {mode !== "pv" ? <ProductVisual type="battery" title={storageLabel} subtitle="Magazyn energii" /> : null}
          {rainwaterLabel ? <ProductVisual type="rainwater" title="Deszczówka" subtitle={rainwaterLabel} /> : null}
        </div>

        <dl className="grid gap-2 rounded-lg border border-line bg-[#f9fbfd] p-4 text-sm">
          {mode !== "storage" ? <OfferLine label="Moc systemu" value={`${formatNumber.format(row.kwp)} kWp`} /> : null}
          {mode !== "storage" ? <OfferLine label="Moduły" value={`${row.panelCount} x JA Solar 500 W`} /> : null}
          <OfferLine label="Inwerter" value={inverterLabel} />
          {mode !== "pv" ? <OfferLine label="Magazyn energii" value={storageLabel} /> : null}
          {rainwaterLabel ? <OfferLine label="System deszczówki" value={rainwaterLabel} /> : null}
          <OfferLine label="Okablowanie AC/DC, konstrukcja, uziemienie" value="w cenie" />
          <OfferLine label="Pomiary, testy, uruchomienie i zgłoszenie OSD" value="w cenie" />
          <OfferLine label="Monitoring 24/7" value="w cenie" />
        </dl>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Cena netto</div>
            <div className="mt-1 text-2xl font-black text-ink">{formatMoney.format(net)}</div>
          </div>
          <div className="rounded-lg border border-leaf/20 bg-leaf/10 p-4 text-[#23682e]">
            <div className="text-xs font-bold uppercase tracking-wide">Cena brutto</div>
            <div className="mt-1 text-2xl font-black">{formatMoney.format(gross)}</div>
          </div>
          <div className="rounded-lg border border-line p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Rata przed dotacją</div>
            <div className="mt-1 text-xl font-black text-ink">{formatMoney.format(installmentBefore)}</div>
          </div>
          <div className="rounded-lg border border-line p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Rata po dotacji</div>
            <div className="mt-1 text-xl font-black text-ink">{formatMoney.format(installmentAfter)}</div>
            {subsidy > 0 ? <div className="mt-1 text-xs text-muted">Uwzględniono: {formatMoney.format(subsidy)}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function OfferLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2 last:border-b-0">
      <dt className="font-semibold text-muted">{label}</dt>
      <dd className="text-right font-bold text-ink">{value}</dd>
    </div>
  );
}

