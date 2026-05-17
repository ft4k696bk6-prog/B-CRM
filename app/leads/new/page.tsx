"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { RegionFields } from "@/components/region-fields";
import { LEAD_SOURCES, type LeadSource } from "@/lib/lead-sources";
import { canCreateManualLead, canManageLeads, homePathForRole } from "@/lib/roles";
import { useAuth } from "@/lib/use-auth";

export default function NewLeadPage() {
  const router = useRouter();
  const { loading, profile, session } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [voivodeship, setVoivodeship] = useState("");
  const [county, setCounty] = useState("");
  const [source, setSource] = useState<LeadSource>("własne");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canManage = canManageLeads(profile?.role);
  const canCreate = canCreateManualLead(profile?.role);
  const backHref = homePathForRole(profile?.role);

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setError("");

    if (!fullName.trim() || !phone.trim()) {
      setError("Wpisz imię i nazwisko oraz numer telefonu.");
      return;
    }

    setBusy(true);

    const payload = {
      full_name: fullName.trim(),
      phone: phone.trim(),
      postal_code: postalCode.trim() || null,
      address: address.trim() || null,
      voivodeship: voivodeship || null,
      county: county || null,
      source,
      status: canManage ? "Nowy" : "Przypisany",
      assigned_to: canManage ? null : profile.id
    };

    const response = await fetch("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok || !data?.id) {
      setError(data.error || "Nie udało się dodać leada.");
      setBusy(false);
      return;
    }

    router.replace(`/leads/${data.id}`);
  }

  if (loading || !profile) return <LoadingScreen />;

  if (!canCreate) {
    return (
      <AppShell profile={profile}>
        <div className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <h1 className="section-title">Brak dostępu</h1>
          <p className="mt-2 text-sm text-muted">Twoja rola nie pozwala tworzyć leadów. Poproś administratora o zmianę uprawnień, jeśli to błąd.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="section-title">Nowy lead</h1>
            <p className="mt-1 text-sm text-muted">
              Ręczne dodanie kontaktu z własnego źródła, polecenia, B2B albo B2C.
            </p>
          </div>
          <Link href={backHref} className="btn-secondary w-fit">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Wróć
          </Link>
        </div>

        {error ? (
          <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">
            {error}
          </div>
        ) : null}

        <form onSubmit={createLead} className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky/10 text-sky">
              <UserPlus className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Dane kontaktowe</h2>
              <p className="text-sm text-muted">
                Źródło można wybrać jako własne, polecenie, B2B albo B2C.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="label">Imię i nazwisko</span>
              <input
                className="field"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="np. Jan Kowalski"
              />
            </label>
            <label>
              <span className="label">Telefon</span>
              <input
                className="field"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="np. 500 600 700"
              />
            </label>
            <label>
              <span className="label">Źródło</span>
              <select
                className="field"
                value={source}
                onChange={(event) => setSource(event.target.value as LeadSource)}
              >
                {LEAD_SOURCES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Kod pocztowy</span>
              <input
                className="field"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                placeholder="np. 30-001"
              />
            </label>
            <label className="md:col-span-2">
              <span className="label">Adres</span>
              <input
                className="field"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Ulica, numer, miejscowość"
              />
            </label>
            <RegionFields
              className="md:col-span-2"
              voivodeship={voivodeship}
              county={county}
              onVoivodeshipChange={setVoivodeship}
              onCountyChange={setCounty}
            />
          </div>

          <button type="submit" disabled={busy} className="btn-primary mt-5">
            <Save className="h-4 w-4" aria-hidden="true" />
            Dodaj leada
          </button>
        </form>
      </div>
    </AppShell>
  );
}
