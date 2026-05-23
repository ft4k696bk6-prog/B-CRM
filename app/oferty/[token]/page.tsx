import { notFound } from "next/navigation";
import { BatteryCharging, CheckCircle2, FileText, Leaf, ShieldCheck, Zap } from "lucide-react";
import { getServiceClient } from "@/lib/server-auth";
import { OfferEventTracker } from "./offer-event-tracker";

type OfferPageProps = {
  params: Promise<{ token: string }>;
};

type OfferDeliveryRow = {
  id: string;
  public_token: string;
  subject: string | null;
  recipient_email: string | null;
  sent_at: string | null;
  metadata: Record<string, unknown> | null;
  lead: { full_name: string | null; phone: string | null; source: string | null } | null;
  owner: { full_name: string | null } | null;
};

export default async function PublicOfferPage({ params }: OfferPageProps) {
  const { token } = await params;
  const supabaseAdmin = getServiceClient();
  const { data } = await supabaseAdmin
    .from("offer_deliveries")
    .select("id,public_token,subject,recipient_email,sent_at,metadata,lead:leads(full_name,phone,source),owner:profiles!offer_deliveries_owner_id_fkey(full_name)")
    .eq("public_token", token)
    .single<OfferDeliveryRow>();

  if (!data) notFound();

  const portalUrl = typeof data.metadata?.portal_url === "string" ? data.metadata.portal_url : "";
  void portalUrl;

  return (
    <main className="min-h-screen bg-[#f3f7f4] text-[#101722]">
      <OfferEventTracker token={token} />
      <section className="mx-auto grid min-h-screen max-w-5xl content-center gap-6 px-5 py-10">
        <div className="grid gap-6 rounded-lg border border-[#d7e2dc] bg-white p-6 shadow-[0_20px_80px_rgba(16,23,34,0.12)] md:grid-cols-[1fr_0.8fr] md:p-8">
          <div>
            <div className="mb-8 inline-flex items-center gap-2 rounded-md border border-[#cfe6dc] bg-[#eef8f3] px-3 py-2 text-xs font-black uppercase tracking-wide text-[#1d7556]">
              <Leaf className="h-4 w-4" aria-hidden="true" />
              Re-Energy System
            </div>
            <h1 className="max-w-2xl text-4xl font-black tracking-normal text-[#101722] md:text-5xl">
              Oferta energii, która pracuje dla domu przez cały rok
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#4d5a64]">
              Przygotowaliśmy zestawienie dla klienta po spotkaniu: fotowoltaika, magazyn energii, logika pracy systemu
              i najważniejsze kroki przed umową.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/materials/b-crm-energy-prezentacja.pdf" data-offer-track="downloaded" className="btn-primary">
                <FileText className="h-4 w-4" aria-hidden="true" />
                Pobierz prezentację
              </a>
              <a href="mailto:biuro@re-energysystem.pl" data-offer-track="clicked" className="btn-secondary">
                Zapytaj o szczegóły
              </a>
            </div>
          </div>

          <aside className="grid gap-3">
            <div className="rounded-lg border border-[#d7e2dc] bg-[#f8faf9] p-4">
              <div className="text-xs font-black uppercase tracking-wide text-[#70808b]">Klient</div>
              <div className="mt-1 text-xl font-black">{data.lead?.full_name || "Klient"}</div>
              <div className="mt-1 text-sm font-semibold text-[#60717d]">{data.recipient_email}</div>
            </div>
            {[
              { icon: Zap, title: "Produkcja", text: "Instalacja pracuje wtedy, gdy dom zużywa energię i kiedy oddaje nadwyżkę do sieci." },
              { icon: BatteryCharging, title: "Magazyn", text: "Część energii zostaje na wieczór, awarie i większą autokonsumpcję." },
              { icon: ShieldCheck, title: "Proces", text: "CRM prowadzi checklistę danych, dokumentów, podpisu i realizacji." },
              { icon: CheckCircle2, title: "Następny krok", text: "Po akceptacji przygotowujemy dokumenty i bramę umowy do zatwierdzenia." }
            ].map((item) => (
              <div key={item.title} className="rounded-lg border border-[#d7e2dc] bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-md bg-[#eef8f3] text-[#1d7556]">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-black">{item.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-[#60717d]">{item.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </section>
    </main>
  );
}
