"use client";

import { BookOpenCheck, CreditCard, Download, FileText, Images, Presentation, ShieldCheck, Wrench } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { PageHeader, SectionHeader } from "@/components/ui";
import { realizationAlbums, realizationTotalFiles } from "@/lib/realization-gallery";
import { salesMaterials } from "@/lib/sales-materials";
import { useAuth } from "@/lib/use-auth";

const categoryIcons = {
  presentation: Presentation,
  catalog: Wrench,
  contract: ShieldCheck,
  credit: CreditCard
};

const categoryLabels = {
  presentation: "Prezentacje",
  catalog: "Karty katalogowe",
  contract: "Umowy",
  credit: "Finansowanie"
};

export default function MaterialsPage() {
  const { loading, profile } = useAuth(["owner", "admin", "kierownik", "handlowiec"]);

  if (loading || !profile) return <LoadingScreen />;

  return (
    <AppShell profile={profile}>
      <div className="grid gap-5 pb-20 md:pb-0">
        <PageHeader
          title="Skarbnica wiedzy"
          description="Dokumenty sprzedażowe, karty katalogowe, umowa, wniosek kredytowy i zdjęcia realizacji."
        />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {salesMaterials.map((material) => {
            const Icon = categoryIcons[material.category];

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
                  <a href={material.href} className="btn-primary">
                    {material.href.endsWith(".pdf") ? (
                      <Download className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <FileText className="h-4 w-4" aria-hidden="true" />
                    )}
                    {material.href.startsWith("/") ? "Otwórz" : "Pobierz"}
                  </a>
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
          <SectionHeader
            icon={Images}
            title="Wszystkie realizacje"
            description={`${realizationTotalFiles} zdjęć z folderu Wszystkie realizacje.`}
            tone="leaf"
            className="mb-4"
          />

          <div className="grid gap-4">
            {realizationAlbums.map((album) => (
              <article key={album.id} className="rounded-lg border border-line bg-[#f9fbfd] p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-base font-black text-ink">{album.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted">{album.description}</p>
                  </div>
                  <span className="w-fit rounded-md border border-line bg-white px-2 py-1 text-xs font-bold text-muted">
                    {album.totalFiles} zdjęć
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {album.photos.slice(0, 12).map((photo) => (
                    <a
                      key={photo.src}
                      href={photo.src}
                      target="_blank"
                      rel="noreferrer"
                      className="group block overflow-hidden rounded-md border border-line bg-white"
                    >
                      <img
                        src={photo.src}
                        alt={photo.alt}
                        loading="lazy"
                        className="aspect-square h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                      />
                    </a>
                  ))}
                </div>

                {album.photos.length > 12 ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-bold text-sky">
                      Pokaż więcej zdjęć
                    </summary>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      {album.photos.slice(12).map((photo) => (
                        <a
                          key={photo.src}
                          href={photo.src}
                          target="_blank"
                          rel="noreferrer"
                          className="group block overflow-hidden rounded-md border border-line bg-white"
                        >
                          <img
                            src={photo.src}
                            alt={photo.alt}
                            loading="lazy"
                            className="aspect-square h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                          />
                        </a>
                      ))}
                    </div>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="app-card">
          <SectionHeader icon={BookOpenCheck} title="Porządek materiałów" tone="sky" />
          <p className="text-sm leading-6 text-muted">
            Skarbnica pokazuje wyłącznie materiały z bieżącego zestawu: karty katalogowe, prezentację,
            umowę, wniosek kredytowy oraz realizacje. Widok jest uporządkowany pod rozmowę z klientem i pracę handlowca.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
