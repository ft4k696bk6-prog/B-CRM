"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  BatteryCharging,
  Calculator,
  FileText,
  Percent,
  Printer,
  Zap
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
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

const panels = [
  { id: "standard", name: "Panel mono 435 W", pricePerKw: 2550, note: "wariant ekonomiczny" },
  { id: "premium", name: "Panel full black 450 W", pricePerKw: 2950, note: "wariant prezentacyjny" },
  { id: "top", name: "Panel premium 500 W", pricePerKw: 3350, note: "wyższa moc z m2" }
];

const inverters = [
  { id: "basic", name: "Falownik string", price: 5200 },
  { id: "hybrid", name: "Falownik hybrydowy", price: 8500 },
  { id: "micro", name: "Mikrofalowniki", price: 11200 }
];

const storages = [
  { id: "none", name: "Bez magazynu", capacity: 0, price: 0 },
  { id: "5", name: "Magazyn 5 kWh", capacity: 5, price: 14500 },
  { id: "10", name: "Magazyn 10 kWh", capacity: 10, price: 25500 },
  { id: "15", name: "Magazyn 15 kWh", capacity: 15, price: 36500 }
];

function gross(value: number, vatRate: VatRate) {
  return value * (1 + vatRate / 100);
}

function monthlyInstallment(amount: number, months: number, annualRate: number) {
  if (months <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return amount / months;
  return (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

export default function CalculatorsPage() {
  const { loading, profile } = useAuth();
  const [tab, setTab] = useState<CalculatorTab>("profitability");

  const [bill, setBill] = useState(420);
  const [annualConsumption, setAnnualConsumption] = useState(5200);
  const [energyPrice, setEnergyPrice] = useState(1.15);
  const [systemKw, setSystemKw] = useState(6.2);
  const [productionPerKw, setProductionPerKw] = useState(1000);
  const [selfConsumption, setSelfConsumption] = useState(32);
  const [storageKwh, setStorageKwh] = useState(10);
  const [vatRate, setVatRate] = useState<VatRate>(8);
  const [netCostPerKw, setNetCostPerKw] = useState(3600);
  const [netStorageCostPerKwh, setNetStorageCostPerKwh] = useState(2800);

  const [offerKw, setOfferKw] = useState(6.2);
  const [selectedPanel, setSelectedPanel] = useState("premium");
  const [selectedInverter, setSelectedInverter] = useState("hybrid");
  const [selectedStorage, setSelectedStorage] = useState("10");
  const [mountingPerKw, setMountingPerKw] = useState(1050);
  const [electricalPrice, setElectricalPrice] = useState(1900);
  const [marginPercent, setMarginPercent] = useState(12);
  const [discount, setDiscount] = useState(1500);
  const [loanMonths, setLoanMonths] = useState(120);
  const [loanRate, setLoanRate] = useState(8.9);

  const profitability = useMemo(() => {
    const annualProduction = systemKw * productionPerKw;
    const storageBoost = Math.min(storageKwh * 2.2, 24);
    const effectiveSelfConsumption = Math.min(selfConsumption + storageBoost, 92);
    const selfUsedEnergy = Math.min(annualProduction, annualConsumption) * (effectiveSelfConsumption / 100);
    const exportedEnergy = Math.max(annualProduction - selfUsedEnergy, 0);
    const exportValue = exportedEnergy * energyPrice * 0.45;
    const directSavings = selfUsedEnergy * energyPrice;
    const annualSavings = directSavings + exportValue;
    const investmentNet = systemKw * netCostPerKw + storageKwh * netStorageCostPerKwh;
    const investmentGross = gross(investmentNet, vatRate);

    return {
      annualProduction,
      effectiveSelfConsumption,
      annualSavings,
      investmentGross,
      paybackYears: annualSavings > 0 ? investmentGross / annualSavings : 0,
      billCoverage: Math.min((annualSavings / (bill * 12)) * 100, 100)
    };
  }, [
    annualConsumption,
    bill,
    energyPrice,
    netCostPerKw,
    netStorageCostPerKwh,
    productionPerKw,
    selfConsumption,
    storageKwh,
    systemKw,
    vatRate
  ]);

  const offer = useMemo(() => {
    const panel = panels.find((item) => item.id === selectedPanel) || panels[0];
    const inverter = inverters.find((item) => item.id === selectedInverter) || inverters[0];
    const storage = storages.find((item) => item.id === selectedStorage) || storages[0];
    const equipmentNet =
      offerKw * panel.pricePerKw +
      inverter.price +
      storage.price +
      offerKw * mountingPerKw +
      electricalPrice;
    const marginValue = equipmentNet * (marginPercent / 100);
    const netAfterMargin = equipmentNet + marginValue - discount;
    const grossTotal = gross(Math.max(netAfterMargin, 0), vatRate);

    return {
      panel,
      inverter,
      storage,
      equipmentNet,
      marginValue,
      grossTotal,
      installment: monthlyInstallment(grossTotal, loanMonths, loanRate)
    };
  }, [
    discount,
    electricalPrice,
    loanMonths,
    loanRate,
    marginPercent,
    mountingPerKw,
    offerKw,
    selectedInverter,
    selectedPanel,
    selectedStorage,
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
              Szybkie liczenie opłacalności, ceny, VAT i raty dla klienta.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-line bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setTab("profitability")}
              className={`rounded-md px-4 py-2 text-sm font-bold transition ${
                tab === "profitability" ? "bg-ink text-white" : "text-muted hover:bg-[#eef3f8]"
              }`}
            >
              Opłacalność
            </button>
            <button
              type="button"
              onClick={() => setTab("offer")}
              className={`rounded-md px-4 py-2 text-sm font-bold transition ${
                tab === "offer" ? "bg-ink text-white" : "text-muted hover:bg-[#eef3f8]"
              }`}
            >
              Oferta
            </button>
          </div>
        </div>

        <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-ink">Stawka VAT</h2>
              <p className="mt-1 text-sm text-muted">Wybierz 8% albo 23% dla aktualnych wyliczeń.</p>
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

        {tab === "profitability" ? (
          <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-solar/20 text-[#8a5a00]">
                  <Zap className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-bold text-ink">Dane klienta i instalacji</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="label">Rachunek miesięczny</span>
                  <input className="field" type="number" value={bill} onChange={(event) => setBill(Number(event.target.value))} />
                </label>
                <label>
                  <span className="label">Zużycie roczne kWh</span>
                  <input className="field" type="number" value={annualConsumption} onChange={(event) => setAnnualConsumption(Number(event.target.value))} />
                </label>
                <label>
                  <span className="label">Cena energii zł/kWh</span>
                  <input className="field" type="number" step="0.01" value={energyPrice} onChange={(event) => setEnergyPrice(Number(event.target.value))} />
                </label>
                <label>
                  <span className="label">Moc instalacji kWp</span>
                  <input className="field" type="number" step="0.1" value={systemKw} onChange={(event) => setSystemKw(Number(event.target.value))} />
                </label>
                <label>
                  <span className="label">Produkcja z 1 kWp</span>
                  <input className="field" type="number" value={productionPerKw} onChange={(event) => setProductionPerKw(Number(event.target.value))} />
                </label>
                <label>
                  <span className="label">Autokonsumpcja %</span>
                  <input className="field" type="number" value={selfConsumption} onChange={(event) => setSelfConsumption(Number(event.target.value))} />
                </label>
                <label>
                  <span className="label">Magazyn energii kWh</span>
                  <input className="field" type="number" step="0.1" value={storageKwh} onChange={(event) => setStorageKwh(Number(event.target.value))} />
                </label>
                <label>
                  <span className="label">Koszt netto 1 kWp</span>
                  <input className="field" type="number" value={netCostPerKw} onChange={(event) => setNetCostPerKw(Number(event.target.value))} />
                </label>
                <label className="sm:col-span-2">
                  <span className="label">Koszt netto 1 kWh magazynu</span>
                  <input className="field" type="number" value={netStorageCostPerKwh} onChange={(event) => setNetStorageCostPerKwh(Number(event.target.value))} />
                </label>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ResultTile icon={Zap} label="Produkcja roczna" value={`${formatNumber.format(profitability.annualProduction)} kWh`} tone="solar" />
              <ResultTile icon={BatteryCharging} label="Autokonsumpcja po magazynie" value={`${formatNumber.format(profitability.effectiveSelfConsumption)}%`} tone="leaf" />
              <ResultTile icon={Banknote} label="Oszczędność roczna" value={formatMoney.format(profitability.annualSavings)} tone="sky" />
              <ResultTile icon={Percent} label="Pokrycie rachunków" value={`${formatNumber.format(profitability.billCoverage)}%`} tone="leaf" />
              <div className="sm:col-span-2 rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-muted">Szacowany koszt brutto</div>
                <div className="mt-2 text-3xl font-black text-ink">
                  {formatMoney.format(profitability.investmentGross)}
                </div>
                <div className="mt-2 text-sm text-muted">
                  Szacowany zwrot:{" "}
                  <span className="font-bold text-ink">
                    {formatNumber.format(profitability.paybackYears)} lat
                  </span>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
            <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky/10 text-sky">
                  <Calculator className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-bold text-ink">Konfiguracja oferty</h2>
              </div>

              <div className="grid gap-4">
                <label>
                  <span className="label">Moc instalacji kWp</span>
                  <input className="field" type="number" step="0.1" value={offerKw} onChange={(event) => setOfferKw(Number(event.target.value))} />
                </label>

                <ChoiceGroup
                  label="Panele"
                  value={selectedPanel}
                  options={panels.map((panel) => ({
                    id: panel.id,
                    title: panel.name,
                    meta: `${formatMoney.format(panel.pricePerKw)} / kWp · ${panel.note}`
                  }))}
                  onChange={setSelectedPanel}
                />

                <ChoiceGroup
                  label="Falownik"
                  value={selectedInverter}
                  options={inverters.map((inverter) => ({
                    id: inverter.id,
                    title: inverter.name,
                    meta: formatMoney.format(inverter.price)
                  }))}
                  onChange={setSelectedInverter}
                />

                <ChoiceGroup
                  label="Magazyn energii"
                  value={selectedStorage}
                  options={storages.map((storage) => ({
                    id: storage.id,
                    title: storage.name,
                    meta: storage.capacity ? `${storage.capacity} kWh · ${formatMoney.format(storage.price)}` : "bez dopłaty"
                  }))}
                  onChange={setSelectedStorage}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="label">Montaż netto / kWp</span>
                    <input className="field" type="number" value={mountingPerKw} onChange={(event) => setMountingPerKw(Number(event.target.value))} />
                  </label>
                  <label>
                    <span className="label">Elektryka i zabezpieczenia</span>
                    <input className="field" type="number" value={electricalPrice} onChange={(event) => setElectricalPrice(Number(event.target.value))} />
                  </label>
                  <label>
                    <span className="label">Marża %</span>
                    <input className="field" type="number" value={marginPercent} onChange={(event) => setMarginPercent(Number(event.target.value))} />
                  </label>
                  <label>
                    <span className="label">Rabat brutto/netto</span>
                    <input className="field" type="number" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} />
                  </label>
                  <label>
                    <span className="label">Raty: liczba miesięcy</span>
                    <input className="field" type="number" value={loanMonths} onChange={(event) => setLoanMonths(Number(event.target.value))} />
                  </label>
                  <label>
                    <span className="label">Oprocentowanie roczne %</span>
                    <input className="field" type="number" step="0.1" value={loanRate} onChange={(event) => setLoanRate(Number(event.target.value))} />
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="text-base font-bold text-ink">Podsumowanie oferty</h2>
                </div>
                <button type="button" onClick={() => window.print()} className="btn-secondary">
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Drukuj
                </button>
              </div>

              <div className="rounded-lg border border-leaf/20 bg-leaf/10 p-4">
                <div className="text-sm font-semibold text-[#23682e]">Cena brutto dla klienta</div>
                <div className="mt-2 text-3xl font-black text-[#23682e]">
                  {formatMoney.format(offer.grossTotal)}
                </div>
                <div className="mt-2 text-sm text-[#23682e]">
                  Szacowana rata: <span className="font-black">{formatMoney.format(offer.installment)}</span>
                </div>
              </div>

              <dl className="mt-4 grid gap-3">
                <OfferRow label="Moc" value={`${formatNumber.format(offerKw)} kWp`} />
                <OfferRow label="Panele" value={offer.panel.name} />
                <OfferRow label="Falownik" value={offer.inverter.name} />
                <OfferRow label="Magazyn" value={offer.storage.name} />
                <OfferRow label="Suma netto przed marżą" value={formatMoney.format(offer.equipmentNet)} />
                <OfferRow label="Marża" value={formatMoney.format(offer.marginValue)} />
                <OfferRow label="Rabat" value={`-${formatMoney.format(discount)}`} />
                <OfferRow label="VAT" value={`${vatRate}%`} />
                <OfferRow label="Finansowanie" value={`${loanMonths} mies. / ${loanRate}%`} />
              </dl>

              <p className="mt-4 rounded-md border border-solar/30 bg-solar/10 p-3 text-sm text-[#6f4900]">
                To są wartości robocze. Po otrzymaniu Twojego cennika podmienimy produkty, zdjęcia,
                marże i reguły liczenia na realne.
              </p>
            </div>
          </section>
        )}
      </div>
    </AppShell>
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

function ChoiceGroup({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ id: string; title: string; meta: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-lg border p-3 text-left transition ${
              value === option.id
                ? "border-ink bg-ink text-white"
                : "border-line bg-[#f9fbfd] text-ink hover:border-ink"
            }`}
          >
            <span className="block text-sm font-black">{option.title}</span>
            <span className="mt-1 block text-xs opacity-80">{option.meta}</span>
          </button>
        ))}
      </div>
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

