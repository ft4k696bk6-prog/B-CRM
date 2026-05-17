"use client";

import { useMemo, useState } from "react";
import { Banknote, BatteryCharging, Calculator, Minus, Percent, Plus, Printer, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import {
  EXTRA_NET_PRICES,
  INCLUDED_TOTAL_MARGIN_NET,
  INVERTER_NET_PRICES,
  PACKAGE_OPTIONS,
  PRICE_ROWS,
  STORAGE_NET_PRICES,
  type BoilerCapacity,
  type BoilerLayout,
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

const COMPANY_NIP = "9462741793";
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

function storageImageFor(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("felicity")) return "/products/felicity-storage.jpg";
  if (normalized.includes("deye")) return "/products/deye-storage.webp";
  return "/products/kon-tec-storage.webp";
}

function boilerImageFor(layout: BoilerLayout) {
  return layout === "horizontal" ? "/products/boiler-horizontal.png" : "/products/boiler-vertical.png";
}

export default function CalculatorsPage() {
  const { loading, profile } = useAuth(["owner", "admin", "menadzer", "handlowiec", "finance"]);
  const { settings } = usePricingSettings(profile?.role);
  const [tab, setTab] = useState<CalculatorTab>("offer");
  const [vatRate, setVatRate] = useState<VatRate>(8);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

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
  const [boiler, setBoiler] = useState<BoilerCapacity>("none");
  const [boilerLayout, setBoilerLayout] = useState<BoilerLayout>("vertical");
  const [rainwater, setRainwater] = useState<RainwaterSystem>("none");
  const [backup, setBackup] = useState(false);
  const [extraCableMeters, setExtraCableMeters] = useState(0);
  const [manualAdjustment, setManualAdjustment] = useState(0);
  const [subsidy, setSubsidy] = useState(0);
  const [loanMonths, setLoanMonths] = useState(120);
  const [loanRate, setLoanRate] = useState(6);

  const row = getPriceRowByPanelCount(panelCount);
  const storageProduct = STORAGE_NET_PRICES.find((item) => item.id === storageProductId) || STORAGE_NET_PRICES[1];
  const inverter =
    offerMode === "storage"
      ? INVERTER_NET_PRICES.find((item) => item.kw === inverterKw) || INVERTER_NET_PRICES[1]
      : recommendedInverter(row.kwp);
  const currentStorageKwh =
    offerMode === "pv-storage" ? selectedPackageInfo.storageKwh : offerMode === "storage" ? storageProduct.kwh : 0;

  const profitability = useMemo(() => {
    const annualProduction = row.kwp * productionPerKw;
    const effectiveSelfConsumption = currentStorageKwh > 0 ? 85 : 25;
    const selfUsedEnergy = Math.min(annualProduction, annualConsumption) * (effectiveSelfConsumption / 100);
    const exportedEnergy = Math.max(annualProduction - selfUsedEnergy, 0);
    const annualSavings = selfUsedEnergy * energyPrice + exportedEnergy * energyPrice * 0.45;

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
  }, [annualConsumption, annualGrowth, bill, currentStorageKwh, energyPrice, productionPerKw, row.kwp]);

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
    const boilerNet = boiler === "80" ? EXTRA_NET_PRICES.boiler80 : boiler === "150" ? EXTRA_NET_PRICES.boiler150 : 0;
    const rainwaterNet =
      rainwater === "above-2000"
        ? EXTRA_NET_PRICES.rainwaterAbove2000
        : rainwater === "underground-2000"
          ? EXTRA_NET_PRICES.rainwaterUnderground2000
          : 0;
    const extrasNet =
      pvExtras +
      boilerNet +
      rainwaterNet +
      (backup ? EXTRA_NET_PRICES.backup : 0) +
      extraCableMeters * EXTRA_NET_PRICES.cablePerMeterAbove8m +
      manualAdjustment;
    const finalNet = Math.max(baseNet + settings.adminMargin + settings.salesMargin + extrasNet, 0);
    const finalGross = gross(finalNet, vatRate);
    const creditAfterSubsidy = Math.max(finalGross - subsidy, 0);

    return {
      extrasNet,
      finalNet,
      finalGross,
      installmentBeforeSubsidy: simpleInstallment(finalGross, loanMonths, loanRate),
      installmentAfterSubsidy: simpleInstallment(creditAfterSubsidy, loanMonths, loanRate)
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
  const storageLabel =
    offerMode === "pv-storage"
      ? `${storageBrand} ${selectedPackageInfo.shortLabel}`
      : offerMode === "storage"
        ? storageProduct.label
        : "";
  const storageImageSrc =
    offerMode === "pv-storage"
      ? storageImageFor(storageBrand)
      : offerMode === "storage"
        ? storageImageFor(storageProduct.label)
        : undefined;
  const boilerLabel = boiler === "none" ? "" : `Bojler ${boiler}L ${boilerLayout === "vertical" ? "pionowy" : "poziomy"}`;
  const rainwaterLabel =
    rainwater === "above-2000"
      ? "Naziemny system magazynowania deszczówki 2000L"
      : rainwater === "underground-2000"
        ? "Podziemny betonowy system magazynowania deszczówki 2000L"
        : "";

  function printOffer() {
    const previousTitle = document.title;
    document.title = `Oferta B-CRM ${customerName.trim() || offerTitle}`;
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 500);
  }

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div className="no-print flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="section-title">Kalkulatory</h1>
            <p className="mt-1 text-sm text-muted">Przygotuj konfigurację, sprawdź ratę i zapisz ofertę dla klienta.</p>
          </div>
          <div className="inline-flex rounded-lg border border-line bg-white p-1 shadow-sm">
            <button type="button" onClick={() => setTab("offer")} className={`rounded-md px-4 py-2 text-sm font-bold transition ${tab === "offer" ? "bg-ink text-white" : "text-muted hover:bg-[#eef3f8]"}`}>
              Oferta
            </button>
            <button type="button" onClick={() => setTab("profitability")} className={`rounded-md px-4 py-2 text-sm font-bold transition ${tab === "profitability" ? "bg-ink text-white" : "text-muted hover:bg-[#eef3f8]"}`}>
              Opłacalność
            </button>
          </div>
        </div>

        {tab === "offer" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(560px,0.9fr)]">
            <div className="no-print grid gap-5">
              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky/10 text-sky">
                    <Calculator className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="text-base font-bold text-ink">Konfiguracja</h2>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="label">Klient / adresat oferty</span>
                      <input className="field" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="np. Jan Kowalski" />
                    </label>
                    <label>
                      <span className="label">Telefon klienta</span>
                      <input className="field" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="np. 500 600 700" />
                    </label>
                  </div>

                  <div>
                    <span className="label">Wariant oferty</span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <OfferModeButton active={offerMode === "pv"} title="Samo PV" subtitle="Instalacja fotowoltaiczna" onClick={() => setOfferMode("pv")} />
                      <OfferModeButton active={offerMode === "pv-storage"} title="PV + magazyn" subtitle="Instalacja z magazynem" onClick={() => setOfferMode("pv-storage")} />
                      <OfferModeButton active={offerMode === "storage"} title="Sam magazyn" subtitle="Magazyn + falownik" onClick={() => setOfferMode("storage")} />
                    </div>
                  </div>

                  {offerMode !== "storage" ? (
                    <div>
                      <span className="label">Liczba modułów JA Solar 500 W</span>
                      <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                        <button type="button" className="btn-secondary h-11" onClick={() => setPanelCount((value) => clampPanelCount(value - 1))}>
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <input className="field text-center text-lg font-black" type="number" min={minPanelCount} max={maxPanelCount} value={panelCount} onChange={(event) => setPanelCount(clampPanelCount(Number(event.target.value)))} />
                        <button type="button" className="btn-secondary h-11" onClick={() => setPanelCount((value) => clampPanelCount(value + 1))}>
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-muted">{row.panelCount} modułów daje {formatNumber.format(row.kwp)} kWp.</p>
                    </div>
                  ) : null}

                  {offerMode === "pv-storage" ? (
                    <>
                      <div>
                        <span className="label">Moc magazynu</span>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {packageChoices.map((item) => (
                            <button key={item.id} type="button" onClick={() => { setSelectedPackage(item.id); setStorageBrand(item.brands[0]); }} className={`min-h-20 rounded-lg border p-3 text-left transition ${selectedPackage === item.id ? "border-ink bg-ink text-white" : "border-line bg-[#f9fbfd] text-ink hover:border-ink"}`}>
                              <span className="block text-sm font-black">{item.shortLabel}</span>
                              <span className="mt-1 block text-xs opacity-80">{item.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <label>
                        <span className="label">Marka magazynu</span>
                        <select className="field" value={storageBrand} onChange={(event) => setStorageBrand(event.target.value)}>
                          {selectedPackageInfo.brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                        </select>
                      </label>
                    </>
                  ) : null}

                  {offerMode === "storage" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label>
                        <span className="label">Magazyn energii</span>
                        <select className="field" value={storageProductId} onChange={(event) => setStorageProductId(event.target.value)}>
                          {STORAGE_NET_PRICES.map((storage) => <option key={storage.id} value={storage.id}>{storage.label}</option>)}
                        </select>
                      </label>
                      <label>
                        <span className="label">Moc falownika</span>
                        <select className="field" value={inverterKw} onChange={(event) => setInverterKw(Number(event.target.value))}>
                          {INVERTER_NET_PRICES.map((item) => <option key={item.kw} value={item.kw}>{item.kw} kW</option>)}
                        </select>
                      </label>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-base font-bold text-ink">Dodatki</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {offerMode !== "storage" ? (
                    <>
                      <Toggle label="Montaż gruntowy" checked={groundMount} onChange={setGroundMount} />
                      <Toggle label="Ekierki" checked={triangles} onChange={setTriangles} />
                    </>
                  ) : null}
                  <label>
                    <span className="label">Bojler</span>
                    <select className="field" value={boiler} onChange={(event) => setBoiler(event.target.value as BoilerCapacity)}>
                      <option value="none">Bez bojlera</option>
                      <option value="80">Bojler 80L</option>
                      <option value="150">Bojler 150L</option>
                    </select>
                  </label>
                  {boiler !== "none" ? (
                    <label>
                      <span className="label">Układ bojlera</span>
                      <select className="field" value={boilerLayout} onChange={(event) => setBoilerLayout(event.target.value as BoilerLayout)}>
                        <option value="vertical">Pionowy</option>
                        <option value="horizontal">Poziomy</option>
                      </select>
                    </label>
                  ) : null}
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
                <h2 className="mb-4 text-base font-bold text-ink">Finansowanie</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <NumberField label="Dotacja / wpłata" value={subsidy} min={0} onChange={setSubsidy} />
                  <NumberField label="Liczba miesięcy" value={loanMonths} min={1} onChange={setLoanMonths} />
                  <NumberField label="Oprocentowanie roczne %" value={loanRate} step="0.1" min={0} onChange={setLoanRate} />
                </div>
                <button type="button" onClick={printOffer} className="btn-primary mt-4">
                  <Printer className="h-4 w-4" aria-hidden="true" />
Drukuj / zapisz PDF
                </button>
              </section>
            </div>

            <OfferDocument
              title={offerTitle}
              mode={offerMode}
              row={row}
              inverterLabel={inverter.label}
              storageLabel={storageLabel}
              storageImageSrc={storageImageSrc}
              rainwaterLabel={rainwaterLabel}
              boilerLabel={boilerLabel}
              boilerImageSrc={boiler === "none" ? undefined : boilerImageFor(boilerLayout)}
              net={offer.finalNet}
              gross={offer.finalGross}
              subsidy={subsidy}
              installmentBefore={offer.installmentBeforeSubsidy}
              installmentAfter={offer.installmentAfterSubsidy}
              customerName={customerName}
              customerPhone={customerPhone}
              preparedBy={profile.full_name}
            />
          </section>
        ) : (
          <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-bold text-ink">Dane klienta</h2>
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
                <div className="mt-2 text-3xl font-black text-ink">{formatMoney.format(profitability.cumulativeEnergySpend)}</div>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function OfferModeButton({ active, title, subtitle, onClick }: { active: boolean; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-24 rounded-lg border p-4 text-left transition ${active ? "border-ink bg-ink text-white" : "border-line bg-[#f9fbfd] text-ink hover:border-ink"}`}>
      <span className="block text-base font-black">{title}</span>
      <span className="mt-1 block text-xs opacity-80">{subtitle}</span>
    </button>
  );
}

function NumberField({ label, value, onChange, step = "1", min }: { label: string; value: number; onChange: (value: number) => void; step?: string; min?: number }) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="field" type="number" step={step} min={min} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-line bg-[#f9fbfd] p-3 text-sm font-semibold">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function ResultTile({ icon: Icon, label, value, tone }: { icon: typeof Zap; label: string; value: string; tone: "solar" | "leaf" | "sky" }) {
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

function OfferDocument({
  title,
  mode,
  row,
  inverterLabel,
  storageLabel,
  storageImageSrc,
  rainwaterLabel,
  boilerLabel,
  boilerImageSrc,
  net,
  gross,
  subsidy,
  installmentBefore,
  installmentAfter,
  customerName,
  customerPhone,
  preparedBy
}: {
  title: string;
  mode: OfferMode;
  row: { panelCount: number; kwp: number };
  inverterLabel: string;
  storageLabel: string;
  storageImageSrc?: string;
  rainwaterLabel: string;
  boilerLabel: string;
  boilerImageSrc?: string;
  net: number;
  gross: number;
  subsidy: number;
  installmentBefore: number;
  installmentAfter: number;
  customerName: string;
  customerPhone: string;
  preparedBy: string;
}) {
  return (
    <section className="offer-document relative mx-auto w-full max-w-[794px] overflow-hidden rounded-lg border border-line bg-white p-0 shadow-sm">
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-7 bg-[#1f2024]" />
      <div
        className="pointer-events-none absolute right-0 top-10 h-24 w-10 bg-[#00a651]"
        style={{ clipPath: "polygon(55% 0, 100% 0, 100% 100%, 0 100%)" }}
      />
      <div
        className="pointer-events-none absolute bottom-14 right-0 h-44 w-10 bg-[#00a651]"
        style={{ clipPath: "polygon(0 15%, 100% 0, 100% 100%, 0 86%)" }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-6 h-7 w-[88%] bg-[#00a651]"
        style={{ clipPath: "polygon(4% 0, 100% 0, 96% 100%, 0 100%)" }}
      />

      <div className="relative px-6 pb-10 pt-7 sm:px-9">
        <header className="mb-8 flex justify-center">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#7b7f86] text-[#1f2024]">
              <Zap className="h-7 w-7" aria-hidden="true" />
            </span>
            <span className="h-10 w-px bg-[#7b7f86]" />
            <span>
              <span className="block text-2xl font-light uppercase tracking-[0.08em] text-[#1f2024]">
                RE-ENERGY SYSTEM
              </span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.42em] text-[#4d525a]">
                Energia ze słońca i wiatru
              </span>
            </span>
          </div>
        </header>

        <div className="mb-4 grid gap-2 border-b border-line pb-4 text-[#1f2024] sm:grid-cols-[1fr_auto]">
          <div>
            <div className="text-lg font-black">{title}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Oferta ważna 14 dni · przygotowana w B-CRM</div>
          </div>
          <div className="text-left text-xs font-semibold sm:text-right">
            <div>Data: {new Intl.DateTimeFormat("pl-PL").format(new Date())}</div>
            <div>Klient: {customerName.trim() || "do uzupełnienia"}</div>
            {customerPhone.trim() ? <div>Tel.: {customerPhone.trim()}</div> : null}
          </div>
        </div>

        <dl className="offer-specs grid text-sm">
          {mode !== "storage" ? <OfferSpecRow label="Moc systemu" value={`${formatNumber.format(row.kwp)} kWp`} shaded /> : null}
          <OfferSpecRow label="Moc magazynu energii" value={mode !== "pv" ? storageLabel : "brak magazynu"} />
          <OfferSpecRow label="Pojemność magazynu ciepła" value={boilerLabel || "brak bojlera"} shaded />
          {mode !== "storage" ? <OfferSpecRow label="Moduły" value={`${row.panelCount} x JA Solar 500 W`} /> : null}
          <OfferSpecRow label="Inwerter" value={inverterLabel} shaded />
          <OfferSpecRow label="Okablowanie AC i DC" value="w cenie" />
          <OfferSpecRow label="Konstrukcja" value="w cenie" shaded strongLabel />
          <OfferSpecRow label="Uziemienie" value="w cenie" />
          <OfferSpecRow label="Ograniczniki przepięć po stronie AC i DC" value="w cenie" shaded />
          <OfferSpecRow label="Optymalizatory mocy" value="opcjonalnie" />
          <OfferSpecRow label="Konfiguracja z siecią WiFi" value="w cenie" shaded />
          <OfferSpecRow label="Pomiary, testy i końcowe uruchomienie" value="w cenie" />
          <OfferSpecRow label="Zgłoszenie OSD" value="w cenie" shaded />
          <OfferSpecRow label="Monitoring 24/7" value="w cenie" />
          {rainwaterLabel ? <OfferSpecRow label="System magazynowania deszczówki" value={rainwaterLabel} shaded /> : null}
        </dl>

        <div className="offer-products my-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {mode !== "storage" ? (
            <OfferProduct image="/products/ja-solar-panel.webp" title="JA Solar" subtitle={`${row.panelCount} modułów`} />
          ) : null}
          <OfferProduct image="/products/deye-inverter.webp" title="Deye" subtitle="Falownik hybrydowy LV" />
          {mode !== "pv" ? <OfferProduct image={storageImageSrc || "/products/kon-tec-storage.webp"} title={storageLabel} subtitle="Magazyn energii" /> : null}
          {boilerLabel ? <OfferProduct image={boilerImageSrc || "/products/boiler-vertical.png"} title="Bojler" subtitle={boilerLabel} /> : null}
          {rainwaterLabel ? <OfferProduct image="/products/rainwater-system.png" title="Deszczówka" subtitle="System 2000L" /> : null}
        </div>

        <div className="offer-prices overflow-hidden bg-[#00a651] text-sm text-black">
          <GreenPriceRow label="Cena netto" value={formatMoney.format(net)} />
          <GreenPriceRow label="Cena brutto z VAT" value={formatMoney.format(gross)} />
          <GreenPriceRow label="Wysokość dotacji" value={subsidy > 0 ? formatMoney.format(subsidy) : "do ustalenia"} />
          <GreenPriceRow label="Cena po dotacji" value={formatMoney.format(Math.max(gross - subsidy, 0))} />
          <div className="grid grid-cols-2 border-t border-[#7bd59f]">
            <div className="px-3 py-2 font-semibold">Rata przed dotacją</div>
            <div className="border-l border-[#7bd59f] px-3 py-2 font-semibold">Rata po dotacji</div>
            <div className="px-3 pb-3 font-black">{formatMoney.format(installmentBefore)}</div>
            <div className="border-l border-[#7bd59f] px-3 pb-3 font-black">
              {formatMoney.format(installmentAfter)}
            </div>
          </div>
        </div>

        <div className="offer-signature mt-7 grid gap-3 text-base text-[#1f2024]">
          <div>Oferta przygotowana przez: <strong>{preparedBy || "______________________________"}</strong></div>
          <div>Akceptacja klienta: ______________________________________</div>
        </div>

        <footer className="offer-footer mt-12 grid gap-3 border-t border-line pt-4 text-[10px] leading-4 text-[#2f3440] sm:grid-cols-3">
          <div>Re-Energy System Sp. z o. o.<br />ul. Kowalska 5/203, 20-115 Lublin<br />NIP: {COMPANY_NIP}</div>
          <div>Biuro@re-energysystem.pl<br />www.re-energysystem.pl</div>
          <div>+48 729 796 441</div>
        </footer>
      </div>
    </section>
  );
}

function OfferSpecRow({
  label,
  value,
  shaded = false,
  strongLabel = false
}: {
  label: string;
  value: string;
  shaded?: boolean;
  strongLabel?: boolean;
}) {
  return (
    <div className={`grid gap-2 px-4 py-2 sm:grid-cols-[1fr_1fr] ${shaded ? "bg-[#eeeeee]" : "bg-white"}`}>
      <dt className={`${strongLabel ? "font-black" : "font-medium"} text-[#1f2024]`}>{label}</dt>
      <dd className="font-semibold text-[#1f2024] sm:text-right">{value}</dd>
    </div>
  );
}

function OfferProduct({ image, title, subtitle }: { image: string; title: string; subtitle: string }) {
  return (
    <div className="grid min-h-32 grid-rows-[1fr_auto] rounded-md border border-line bg-white p-2">
      <div className="flex h-24 items-center justify-center">
        <img src={image} alt={title} className="max-h-full max-w-full object-contain" />
      </div>
      <div className="pt-2 text-center">
        <div className="truncate text-xs font-black text-[#1f2024]">{title}</div>
        <div className="truncate text-[10px] font-semibold text-muted">{subtitle}</div>
      </div>
    </div>
  );
}

function GreenPriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_1fr] border-b border-[#7bd59f]">
      <div className="px-3 py-2 font-semibold">{label}</div>
      <div className="border-l border-[#7bd59f] px-3 py-2 font-black">{value}</div>
    </div>
  );
}
