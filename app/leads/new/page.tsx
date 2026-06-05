"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { RegionFields } from "@/components/region-fields";
import { Alert, PageHeader, SectionHeader } from "@/components/ui";
import { LEAD_SOURCES, type LeadSource } from "@/lib/lead-sources";
import { canCreateManualLead, canManageLeads, homePathForRole } from "@/lib/roles";
import { isLocalCrmFallback, supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";

const newLeadCopy = {
  title: "Nowy lead",
  description: "Dodaj kontakt z własnego źródła, polecenia, B2B albo B2C.",
  back: "Wróć",
  noAccessTitle: "Brak dostępu",
  noAccessDescription: "Twoja rola nie pozwala tworzyć leadów. Poproś administratora o zmianę uprawnień, jeśli to błąd.",
  errorRequired: "Wpisz imię i nazwisko oraz numer telefonu.",
  errorCreate: "Nie udało się dodać leada.",
  contactTitle: "Dane kontaktowe",
  contactDescription: "Wybierz źródło i uzupełnij podstawowe dane klienta.",
  fullName: "Imię i nazwisko",
  fullNamePlaceholder: "np. Jan Kowalski",
  phone: "Telefon",
  phonePlaceholder: "np. 500 600 700",
  source: "Źródło",
  postalCode: "Kod pocztowy",
  postalCodePlaceholder: "np. 30-001",
  address: "Adres",
  addressPlaceholder: "Ulica, numer, miejscowość",
  addLead: "Dodaj leada"
} as const;

const leadSourceLabels = {
  własne: "własne",
  polecenie: "polecenie",
  B2B: "B2B",
  B2C: "B2C"
} satisfies Record<LeadSource, string>;

export default function NewLeadPage() {
  const router = useRouter();
  const { loading, profile, session } = useAuth();
  const copy = newLeadCopy;
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
      setError(copy.errorRequired);
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

    if (isLocalCrmFallback) {
      const { data, error: localError } = await supabase
        .from("leads")
        .insert({ ...payload, crm_environment: profile.crm_environment })
        .select("id")
        .single();

      if (localError || !data || !("id" in data)) {
        setError(localError?.message || copy.errorCreate);
        setBusy(false);
        return;
      }

      router.replace(`/leads/${String(data.id)}`);
      return;
    }

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
      setError(data.error || copy.errorCreate);
      setBusy(false);
      return;
    }

    router.replace(`/leads/${data.id}`);
  }

  if (loading || !profile) return <LoadingScreen />;

  if (!canCreate) {
    return (
      <AppShell profile={profile}>
        <div className="app-card">
          <h1 className="section-title">{copy.noAccessTitle}</h1>
          <p className="mt-2 text-sm text-muted">{copy.noAccessDescription}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5">
        <PageHeader
          title={copy.title}
          description={copy.description}
          actions={
            <Link href={backHref} className="btn-secondary w-fit">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {copy.back}
            </Link>
          }
        />

        {error ? (
          <Alert tone="danger">{error}</Alert>
        ) : null}

        <form onSubmit={createLead} className="app-card" data-tour-id="tour-new-lead">
          <SectionHeader
            icon={UserPlus}
            title={copy.contactTitle}
            description={copy.contactDescription}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="label">{copy.fullName}</span>
              <input
                className="field"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder={copy.fullNamePlaceholder}
              />
            </label>
            <label>
              <span className="label">{copy.phone}</span>
              <input
                className="field"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={copy.phonePlaceholder}
              />
            </label>
            <label>
              <span className="label">{copy.source}</span>
              <select
                className="field"
                value={source}
                onChange={(event) => setSource(event.target.value as LeadSource)}
              >
                {LEAD_SOURCES.map((item) => (
                  <option key={item} value={item}>
                    {leadSourceLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">{copy.postalCode}</span>
              <input
                className="field"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                placeholder={copy.postalCodePlaceholder}
              />
            </label>
            <label className="md:col-span-2">
              <span className="label">{copy.address}</span>
              <input
                className="field"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder={copy.addressPlaceholder}
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
            {copy.addLead}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
