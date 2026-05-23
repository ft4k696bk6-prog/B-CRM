"use client";

import { BookOpenCheck, CheckCircle2, Download, FileText, Presentation, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { PageHeader, SectionHeader } from "@/components/ui";
import { salesMaterials } from "@/lib/sales-materials";
import { useAuth } from "@/lib/use-auth";

const categoryIcons = {
  presentation: Presentation,
  knowledge: BookOpenCheck,
  checklist: CheckCircle2,
  contract: ShieldCheck,
  technical: Wrench
};

const categoryLabels = {
  presentation: "Prezentacje",
  knowledge: "Wiedza",
  checklist: "Checklisty",
  contract: "Umowy",
  technical: "Techniczne"
};

export default function MaterialsPage() {
  const { loading, profile } = useAuth(["owner", "admin", "kierownik", "handlowiec"]);

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5 pb-20 md:pb-0">
        <PageHeader
          title="Skarbnica wiedzy"
          description="Materiały dla handlowca, prezentacja ogólna i checklisty procesu. Bez cen oraz bez tematów researchowych."
        />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {salesMaterials.map((material) => {
            const Icon = categoryIcons[material.category];
            const isInternal = material.href.startsWith("/");

            return (
              <article key={material.id} className="app-card flex min-h-[220px] flex-col justify-between">
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="app-icon bg-sky/10 text-sky">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="rounded-md border border-line bg-[#f8fafc] px-2 py-1 text-xs font-bold text-muted">
                      {categoryLabels[material.category]}
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-ink">{material.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{material.description}</p>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {isInternal ? (
                    <Link href={material.href} className="btn-primary">
                      {material.href.endsWith(".pdf") ? (
                        <Download className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <FileText className="h-4 w-4" aria-hidden="true" />
                      )}
                      Otwórz
                    </Link>
                  ) : (
                    <a href={material.href} className="btn-primary">
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Pobierz
                    </a>
                  )}
                  {material.offlineReady ? (
                    <span className="rounded-md border border-leaf/20 bg-leaf/10 px-2 py-1 text-xs font-bold text-leaf">
                      Offline
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>

        <section className="app-card">
          <SectionHeader icon={ShieldCheck} title="Zasada prezentacji" tone="leaf" />
          <p className="text-sm leading-6 text-muted">
            Prezentacja klienta jest materiałem ogólnym. Nie zawiera ceny, Pstryk, EMS/AI ani tematów, które są nadal
            researchowe. Cena i oferta wychodzą dopiero z procesu spotkania w CRM.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
