"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MousePointerClick, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import type { Profile } from "@/lib/types";

export type DemoTourStep = {
  path: string;
  navTourId: string;
  pageTourId: string;
  labelPl: string;
  labelEn: string;
  problemPl: string;
  problemEn: string;
  actionPl: string;
  actionEn: string;
  effectPl: string;
  effectEn: string;
};

type DemoTourTarget = {
  top: number;
  left: number;
  side: "left" | "right";
  variant: "focus" | "next";
};

const demoTourSteps: DemoTourStep[] = [
  {
    path: "/admin",
    navTourId: "tour-nav-dashboard",
    pageTourId: "tour-dashboard",
    labelPl: "Panel",
    labelEn: "Dashboard",
    problemPl: "Zarząd i admin potrzebują szybkiego obrazu CRM bez wchodzenia w każdy rekord.",
    problemEn: "Leadership and admins need a quick CRM overview without opening each record.",
    actionPl: "Panel pokazuje statusy, wolumen leadów i najważniejsze skróty operacyjne.",
    actionEn: "The dashboard shows statuses, lead volume and the key operational shortcuts.",
    effectPl: "Pierwszy ekran daje kontekst, a kolejne zakładki prowadzą przez działy.",
    effectEn: "The first screen gives context, then the next tabs walk through departments."
  },
  {
    path: "/leads/new",
    navTourId: "tour-nav-new-lead",
    pageTourId: "tour-new-lead",
    labelPl: "Dodanie leada",
    labelEn: "New lead",
    problemPl: "Handlowiec nie powinien przepisywać tych samych danych kilka razy.",
    problemEn: "Sales should not retype the same client data several times.",
    actionPl: "CRM zbiera źródło, telefon, adres i region w jednym prostym formularzu.",
    actionEn: "CRM captures source, phone, address and region in one simple form.",
    effectPl: "Lead może od razu wejść do dalszej pracy, przypisania i procesu umowy.",
    effectEn: "The lead can immediately move into assignment, follow-up and contract flow."
  },
  {
    path: "/calculators",
    navTourId: "tour-nav-calculators",
    pageTourId: "tour-calculators",
    labelPl: "Kalkulatory",
    labelEn: "Calculators",
    problemPl: "Oferta, opłacalność i rata często są liczone poza CRM.",
    problemEn: "Offers, profitability and installments are often calculated outside CRM.",
    actionPl: "Kalkulatory korzystają z danych klienta i pozwalają szybko przygotować ofertę.",
    actionEn: "Calculators use client data and help prepare an offer quickly.",
    effectPl: "Sprzedaż ma jedną ścieżkę od leadu do umowy i finansowania.",
    effectEn: "Sales has one path from lead to contract and financing."
  },
  {
    path: "/realizacja",
    navTourId: "tour-nav-process",
    pageTourId: "tour-process",
    labelPl: "Umowy i proces",
    labelEn: "Contracts and process",
    problemPl: "Po podpisaniu umowy dane klienta nie mogą gubić się między działami.",
    problemEn: "After signing, client data cannot get lost between departments.",
    actionPl: "CRM trzyma klienta, umowę, opiekuna, status i procent realizacji w jednym procesie.",
    actionEn: "CRM keeps the client, contract, owner, status and completion percentage in one process.",
    effectPl: "Każdy dział pracuje na tym samym rekordzie, bez przepisywania danych.",
    effectEn: "Every department works from the same record without retyping data."
  },
  {
    path: "/finance",
    navTourId: "tour-nav-finance",
    pageTourId: "tour-finance-calculator",
    labelPl: "Finanse",
    labelEn: "Finance",
    problemPl: "Finansowanie często żyje obok CRM i traci kontekst klienta.",
    problemEn: "Financing often lives outside CRM and loses client context.",
    actionPl: "Dział finansowy widzi kwoty, ratę i decyzję na danych z umowy.",
    actionEn: "Finance sees amounts, installment and decision from contract data.",
    effectPl: "Nie trzeba ponownie wpisywać klienta do kalkulacji lub sprawy kredytowej.",
    effectEn: "The client does not need to be re-entered into calculations or the credit case."
  },
  {
    path: "/accounting",
    navTourId: "tour-nav-accounting",
    pageTourId: "tour-accounting-actions",
    labelPl: "Księgowość",
    labelEn: "Accounting",
    problemPl: "Księgowość nie powinna szukać numerów umów, kwot i danych nabywcy w mailach.",
    problemEn: "Accounting should not hunt for contract numbers, amounts and buyer data in emails.",
    actionPl: "CRM pokazuje paczkę księgową, KSeF, fakturę i aneks na tych samych danych.",
    actionEn: "CRM shows accounting package, KSeF, invoice and annex from the same data.",
    effectPl: "Rozliczenie jest szybsze i spójne z procesem realizacji.",
    effectEn: "Settlement is faster and consistent with the operations process."
  },
  {
    path: "/equipment",
    navTourId: "tour-nav-equipment",
    pageTourId: "tour-equipment-documents",
    labelPl: "Sprzęt i magazyn",
    labelEn: "Equipment and warehouse",
    problemPl: "Magazyn musi wiedzieć, co zamówić i zarezerwować, dopiero po akceptacji procesu.",
    problemEn: "Warehouse needs to know what to order and reserve only after process approval.",
    actionPl: "Sprzęt z umowy trafia do widoku magazynu razem z PZ i rezerwacją WZ.",
    actionEn: "Contract equipment goes into the warehouse view with receipt and issue reservation.",
    effectPl: "Towar jest przygotowany pod konkretny montaż, a nie szukany na końcu.",
    effectEn: "Goods are prepared for a specific installation instead of being chased at the end."
  },
  {
    path: "/logistics",
    navTourId: "tour-nav-logistics",
    pageTourId: "tour-logistics-plan",
    labelPl: "Logistyka",
    labelEn: "Logistics",
    problemPl: "Terminy, dostawa i przekazanie do ekip muszą być zsynchronizowane.",
    problemEn: "Dates, delivery and handoff to crews must stay synchronized.",
    actionPl: "Logistyka widzi gotowość księgowości, rezerwację sprzętu, adres i termin montażu.",
    actionEn: "Logistics sees accounting readiness, equipment reservation, address and installation date.",
    effectPl: "Operacje prowadzą sprawę dalej bez dopytywania kilku działów.",
    effectEn: "Operations can move the case forward without chasing several teams."
  },
  {
    path: "/installation",
    navTourId: "tour-nav-installation",
    pageTourId: "tour-installation-closeout",
    labelPl: "Montaż",
    labelEn: "Installation",
    problemPl: "Ekipa terenowa potrzebuje prostych, kompletnych danych, bez CRM-owego hałasu.",
    problemEn: "Field teams need simple, complete data without CRM noise.",
    actionPl: "Widok montażu pokazuje adres, telefon, termin, specyfikację i dokumenty końcowe.",
    actionEn: "Installation view shows address, phone, date, specification and final documents.",
    effectPl: "Proces kończy się montażem, fakturą końcową i WZ z właściwą datą.",
    effectEn: "The process ends with installation, final invoice and goods issue on the right date."
  }
];

export function DemoTour({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focusTarget, setFocusTarget] = useState<DemoTourTarget | null>(null);
  const [nextTarget, setNextTarget] = useState<DemoTourTarget | null>(null);
  const storageKey = useMemo(() => `bcrm-demo-tour-seen:${profile.id}`, [profile.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(storageKey)) return;
    const startIndex = Math.max(0, demoTourSteps.findIndex((step) => step.path === pathname));
    setActiveIndex(startIndex);
    setOpen(true);
  }, [pathname, storageKey]);

  useEffect(() => {
    function startTour() {
      if (typeof window !== "undefined") window.sessionStorage.removeItem(storageKey);
      setActiveIndex(0);
      setOpen(true);
    }

    window.addEventListener("bcrm:demo-tour-start", startTour);
    return () => window.removeEventListener("bcrm:demo-tour-start", startTour);
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    const currentPathIndex = demoTourSteps.findIndex((step) => step.path === pathname);
    if (currentPathIndex >= 0) setActiveIndex(currentPathIndex);
  }, [open, pathname]);

  const activeStep = demoTourSteps[activeIndex] || demoTourSteps[0];
  const nextStep = demoTourSteps[activeIndex + 1] || null;
  const isOnStepPage = pathname === activeStep.path;
  const focusTourId = isOnStepPage ? activeStep.pageTourId : activeStep.navTourId;
  const nextTourId = isOnStepPage && nextStep ? nextStep.navTourId : null;

  useEffect(() => {
    if (!open) {
      setFocusTarget(null);
      setNextTarget(null);
      return;
    }

    function targetFromElement(tourId: string, variant: DemoTourTarget["variant"]) {
      const element = document.querySelector(`[data-tour-id="${tourId}"]`);
      if (!element) return null;

      const rect = element.getBoundingClientRect();
      const side = rect.left > 90 ? "left" : "right";
      return {
        top: rect.top + rect.height / 2,
        left: side === "left" ? Math.max(12, rect.left - 46) : Math.min(window.innerWidth - 52, rect.right + 10),
        side,
        variant
      } satisfies DemoTourTarget;
    }

    function updateTargets() {
      setFocusTarget(targetFromElement(focusTourId, "focus"));
      setNextTarget(nextTourId ? targetFromElement(nextTourId, "next") : null);
    }

    updateTargets();
    window.addEventListener("resize", updateTargets);
    window.addEventListener("scroll", updateTargets, true);

    return () => {
      window.removeEventListener("resize", updateTargets);
      window.removeEventListener("scroll", updateTargets, true);
    };
  }, [focusTourId, nextTourId, open]);

  function closeTour() {
    window.sessionStorage.setItem(storageKey, "1");
    setOpen(false);
  }

  if (!open) return null;

  const label = language === "en" ? activeStep.labelEn : activeStep.labelPl;
  const nextLabel = nextStep ? (language === "en" ? nextStep.labelEn : nextStep.labelPl) : "";
  const problem = language === "en" ? activeStep.problemEn : activeStep.problemPl;
  const action = language === "en" ? activeStep.actionEn : activeStep.actionPl;
  const effect = language === "en" ? activeStep.effectEn : activeStep.effectPl;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <TourArrow target={focusTarget} />
      <TourArrow target={nextTarget} />

      <aside className="pointer-events-auto absolute inset-x-3 bottom-4 z-[73] sm:inset-x-auto sm:right-5 sm:top-24 sm:bottom-auto sm:w-[390px]">
        <div className="rounded-lg border border-danger/20 bg-white/90 p-4 shadow-soft backdrop-blur-md">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-black uppercase tracking-wide text-danger">
                <MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" />
                {language === "en" ? "Guided demo" : "Samouczek demo"}
              </div>
              <h2 className="mt-3 text-base font-black text-ink">
                {activeIndex + 1}/{demoTourSteps.length}: {label}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeTour}
              className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-md border border-line bg-white text-muted transition hover:border-ink hover:text-ink"
              aria-label={language === "en" ? "End tour" : "Zakończ samouczek"}
              title={language === "en" ? "End tour" : "Zakończ samouczek"}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-3">
            <GuidePoint label={language === "en" ? "Problem" : "Problem"} value={problem} />
            <GuidePoint label={language === "en" ? "What CRM does" : "Co robi CRM"} value={action} />
            <GuidePoint label={language === "en" ? "Result" : "Efekt"} value={effect} />
          </div>

          <div className="mt-3 rounded-lg border border-danger/20 bg-danger/10 p-3 text-sm font-bold text-danger">
            {nextStep
              ? language === "en"
                ? `First check the highlighted area, then click the next red arrow: ${nextLabel}. The tour shows where to go and what each department sees.`
                : `Najpierw zobacz podświetlony element, potem kliknij kolejną czerwoną strzałkę: ${nextLabel}. Samouczek pokazuje, gdzie klikać i co widzi dany dział.`
              : language === "en"
                ? "This is the last department. Close the tour when you are done."
                : "To ostatni dział. Zamknij samouczek, kiedy skończysz."}
          </div>

          {!focusTarget && !nextTarget ? (
            <div className="mt-3 rounded-lg border border-line bg-[#f8fafc] p-3 text-xs font-semibold text-muted">
              {language === "en"
                ? "If you do not see the arrow, open the menu and choose the indicated tab."
                : "Jeśli nie widzisz strzałki, otwórz menu i wybierz wskazaną zakładkę."}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function TourArrow({ target }: { target: DemoTourTarget | null }) {
  if (!target) return null;

  return (
    <div
      className={`demo-tour-arrow pointer-events-none fixed z-[72] flex h-9 w-9 items-center justify-center rounded-full bg-danger text-white shadow-soft ${
        target.variant === "next" ? "ring-4 ring-danger/15" : ""
      }`}
      style={{ top: target.top - 18, left: target.left }}
    >
      <ArrowRight className={`h-5 w-5 ${target.side === "right" ? "rotate-180" : ""}`} aria-hidden="true" />
    </div>
  );
}

function GuidePoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white/70 p-3">
      <div className="text-xs font-black uppercase tracking-wide text-muted">{label}</div>
      <p className="mt-1 text-sm leading-6 text-ink">{value}</p>
    </div>
  );
}
