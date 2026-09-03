"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  Calculator,
  CalendarDays,
  FileUp,
  FolderKanban,
  Landmark,
  LogOut,
  Menu,
  MousePointerClick,
  PanelLeft,
  RotateCcw,
  Settings,
  UserPlus,
  Warehouse,
  X,
  type LucideIcon
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { useLanguage } from "@/components/language-provider";
import { Alert, ConfirmDialog } from "@/components/ui";
import { demoModeEnabled } from "@/lib/demo-mode";
import { hasAnyPermission } from "@/lib/permissions";
import type { Permission } from "@/lib/permissions";
import { homePathForRole, isSalesRole, isSystemAdminRole, ROLE_LABELS } from "@/lib/roles";
import { isDemoScope } from "@/lib/scope";
import { supabase } from "@/lib/supabase";
import type { Profile, UserRole } from "@/lib/types";

type AppShellProps = {
  profile: Profile;
  children: ReactNode;
  embedded?: boolean;
};

type NavigationLink = {
  href: string;
  labelKey:
    | "navDashboard"
    | "navTeamDashboard"
    | "navMyLeads"
    | "navWorkPanel"
    | "navOperations"
    | "navEquipment"
    | "navNewLead"
    | "navCalendar"
    | "navCalculators"
    | "navSettings"
    | "navImport"
    | "navUsers";
  groupKey: "main" | "sales" | "operations" | "company";
  icon: LucideIcon;
  permissions?: Permission[];
  allowedRoles?: UserRole[];
  hideWhenAnyPermission?: Permission[];
  salesOnly?: boolean;
  tourId?: string;
};

const navigationLinks: NavigationLink[] = [
  {
    href: "/panel",
    labelKey: "navWorkPanel",
    groupKey: "main",
    icon: MousePointerClick,
    permissions: ["operations:view"]
  },
  {
    href: "/admin",
    labelKey: "navDashboard",
    groupKey: "main",
    icon: BarChart3,
    permissions: ["dashboard:view:all"],
    tourId: "tour-nav-dashboard"
  },
  {
    href: "/admin",
    labelKey: "navTeamDashboard",
    groupKey: "main",
    icon: BarChart3,
    permissions: ["dashboard:view:team"],
    hideWhenAnyPermission: ["dashboard:view:all"],
    tourId: "tour-nav-dashboard"
  },
  {
    href: "/sales",
    labelKey: "navMyLeads",
    groupKey: "sales",
    icon: BarChart3,
    permissions: ["dashboard:view:own"],
    salesOnly: true
  },
  {
    href: "/leads/new",
    labelKey: "navNewLead",
    groupKey: "sales",
    icon: UserPlus,
    permissions: ["leads:create:own", "leads:create:pool"],
    tourId: "tour-nav-new-lead"
  },
  {
    href: "/realizacja",
    labelKey: "navOperations",
    groupKey: "operations",
    icon: FolderKanban,
    permissions: ["operations:view"],
    allowedRoles: ["owner", "admin", "menadzer", "finance", "viewer", "ksiegowosc", "logistyk", "monter"],
    tourId: "tour-nav-process"
  },
  {
    href: "/equipment",
    labelKey: "navEquipment",
    groupKey: "operations",
    icon: Warehouse,
    allowedRoles: ["owner", "admin", "logistyk"],
    tourId: "tour-nav-equipment"
  },
  { href: "/calendar", labelKey: "navCalendar", groupKey: "company", icon: CalendarDays, permissions: ["calendar:view"] },
  { href: "/calculators", labelKey: "navCalculators", groupKey: "company", icon: Calculator, permissions: ["offers:calculate"], tourId: "tour-nav-calculators" },
  { href: "/settings", labelKey: "navSettings", groupKey: "company", icon: Settings, permissions: ["settings:view"] },
  { href: "/admin/import", labelKey: "navImport", groupKey: "company", icon: FileUp, permissions: ["data:import"] },
  { href: "/admin/users", labelKey: "navUsers", groupKey: "company", icon: Landmark, permissions: ["users:manage"] }
];

const navigationGroups: Array<{ key: NavigationLink["groupKey"]; labelKey: "navGroupMain" | "navGroupSales" | "navGroupOperations" | "navGroupCompany" }> = [
  { key: "main", labelKey: "navGroupMain" },
  { key: "sales", labelKey: "navGroupSales" },
  { key: "operations", labelKey: "navGroupOperations" },
  { key: "company", labelKey: "navGroupCompany" }
];

const roleLabelsEn: Record<Profile["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  menadzer: "Manager",
  handlowiec: "Sales",
  finance: "Finance",
  viewer: "Viewer",
  ksiegowosc: "Accounting",
  logistyk: "Logistics",
  monter: "Installer"
};

const DemoTour = dynamic(() => import("@/components/demo-tour").then((mod) => mod.DemoTour), {
  ssr: false,
  loading: () => null
});

export function AppShell({ profile, children, embedded = false }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [returningLeads, setReturningLeads] = useState(false);
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [shellNotice, setShellNotice] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const homeHref = homePathForRole(profile.role);
  const roleLabel = language === "en" ? roleLabelsEn[profile.role] : ROLE_LABELS[profile.role];
  const isDemoProfile = demoModeEnabled && isDemoScope(profile.crm_environment);
  const canRunDemoTour = isDemoProfile && isSystemAdminRole(profile.role);
  const links = navigationLinks.filter((link) => {
    if (link.salesOnly && !isSalesRole(profile.role)) return false;
    if (link.hideWhenAnyPermission && hasAnyPermission(profile.role, link.hideWhenAnyPermission)) return false;
    if (link.allowedRoles && !link.allowedRoles.includes(profile.role) && !isSystemAdminRole(profile.role)) return false;
    if (link.permissions) return hasAnyPermission(profile.role, link.permissions);
    return true;
  });

  const salesContractListBlocked = profile.role === "handlowiec" && (pathname === "/realizacja" || pathname === "/realizacja/umowy");
  const gateContent = salesContractListBlocked
        ? <div className="app-card mx-auto max-w-2xl"><Alert tone="info"><strong>Umowy handlowca są dostępne w prostym widoku „Moje umowy”.</strong><br />Znajdziesz tam klienta, numer umowy i bieżący etap bez danych operacyjnych.</Alert><Link href="/sales" className="btn-primary mt-4 min-h-11">Przejdź do moich umów</Link></div>
        : children;

  if (embedded) return <main className="min-h-screen bg-[#f5f7fa] p-3 sm:p-5">{gateContent}</main>;

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function startDemoTour() {
    window.dispatchEvent(new Event("bcrm:demo-tour-start"));
    setMobileOpen(false);
  }

  async function confirmReturnOpenLeads() {
    if (!isSalesRole(profile.role) || returningLeads) return;

    setReturningLeads(true);
    setShellNotice(null);

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setReturningLeads(false);
      setShellNotice({ tone: "danger", message: language === "en" ? "Session expired." : "Sesja wygasła." });
      return;
    }

    const response = await fetch("/api/leads/return", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ ownOpen: true })
    });

    const result = (await response.json().catch(() => ({}))) as { error?: string; updated?: number };

    setReturningLeads(false);

    if (!response.ok) {
      setShellNotice({ tone: "danger", message: result.error || (language === "en" ? "Could not return leads." : "Nie udało się zwrócić leadów.") });
      return;
    }

    setReturnConfirmOpen(false);
    setShellNotice({
      tone: "success",
      message: language === "en" ? `Returned leads: ${result.updated || 0}` : `Zwrócono leady: ${result.updated || 0}`
    });
    window.dispatchEvent(new Event("leads:changed"));
    router.replace(homePathForRole(profile.role));
    router.refresh();
  }

  function renderNavigation(closeOnClick = false) {
    const isMobileMenu = closeOnClick;

    return (
      <nav className="grid gap-4">
        {navigationGroups.map((group) => {
          const groupLinks = links.filter((link) => link.groupKey === group.key);
          if (groupLinks.length === 0) return null;

          return (
            <div key={group.key} className="grid gap-1">
              <div className={`px-2 text-[11px] font-black uppercase tracking-wide ${isMobileMenu ? "text-[#667085]" : "text-muted"}`}>
                {t(group.labelKey)}
              </div>
              {groupLinks.map((link) => {
                const Icon = link.icon;
                const active = pathname === link.href;

                return (
                  <a
                    key={`${link.href}-${link.labelKey}`}
                    href={link.href}
                    data-tour-id={link.tourId}
                    onClick={() => closeOnClick && setMobileOpen(false)}
                    className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-bold transition ${
                      active
                        ? isMobileMenu
                          ? "bg-[#101722] text-white shadow-sm"
                          : "bg-ink text-white shadow-sm ring-1 ring-sky/20"
                        : isMobileMenu
                          ? "text-[#344054] hover:bg-[#f2f4f7] hover:text-[#101722]"
                          : "text-muted hover:bg-sky/10 hover:text-ink"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {t(link.labelKey)}
                  </a>
                );
              })}
            </div>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="btn-icon lg:hidden"
              aria-label={t("menu")}
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>
            <Link href={homeHref} className="flex min-w-0 items-center gap-3">
              <BrandMark size="sm" />
              <span>
                <span className="flex items-center gap-2 text-sm font-bold leading-4">
                  B-CRM
                  {isDemoProfile ? (
                    <span className="rounded-md border border-sky/20 bg-sky/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky">
                      Demo
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-muted">
                  {t("panelPrefix")}: {roleLabel}
                </span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold">{profile.full_name}</div>
              <div className="text-xs text-muted">{profile.email}</div>
            </div>
            {isSalesRole(profile.role) ? (
              <button
                type="button"
                onClick={() => setReturnConfirmOpen(true)}
                disabled={returningLeads}
                className="btn-secondary h-11 w-11 px-0 sm:w-auto sm:px-3"
                title={t("returnLeadsTitle")}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("returnLeads")}</span>
              </button>
            ) : null}
            {canRunDemoTour ? (
              <button
                type="button"
                onClick={startDemoTour}
                className="btn-secondary h-11 w-11 px-0 sm:w-auto sm:px-3"
                title={language === "en" ? "Start guided demo" : "Uruchom samouczek"}
              >
                <MousePointerClick className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{language === "en" ? "Demo tour" : "Samouczek"}</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={signOut}
              className="btn-icon"
              title={t("signOut")}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 isolate z-[80] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 z-0 bg-ink/45 backdrop-blur-sm"
            aria-label="Zamknij menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="mobile-menu-panel fixed inset-y-0 left-0 z-10 flex h-dvh w-[min(88vw,340px)] flex-col border-r p-3 text-[#101722]"
            style={{ background: "#ffffff", color: "#101722", opacity: 1 }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <BrandMark size="sm" />
                <div>
                  <div className="flex items-center gap-2 text-sm font-black text-[#101722]">
                    B-CRM
                    {isDemoProfile ? (
                      <span className="rounded-md border border-sky/20 bg-sky/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky">
                        Demo
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs font-semibold text-[#667085]">{roleLabel}</div>
                </div>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} className="mobile-menu-close" aria-label="Zamknij menu">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mb-2 flex items-center gap-2 px-2 py-2 text-xs font-bold uppercase tracking-wide text-[#667085]">
              <PanelLeft className="h-4 w-4" aria-hidden="true" />
              {t("menu")}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{renderNavigation(true)}</div>
          </aside>
        </div>
      ) : null}

      <div className="app-layout mx-auto grid max-w-[1600px] gap-4 px-2 py-5 sm:px-3 lg:grid-cols-[180px_minmax(0,1fr)] xl:px-4">
        <aside className="app-sidebar hidden rounded-lg border border-line bg-panel p-2 shadow-sm lg:sticky lg:top-20 lg:block lg:h-fit">
          <div className="mb-2 flex items-center gap-2 px-2 py-2 text-xs font-bold uppercase tracking-wide text-muted">
            <PanelLeft className="h-4 w-4" aria-hidden="true" />
            {t("menu")}
          </div>
          {renderNavigation()}
        </aside>

        <main className="min-w-0">
          {shellNotice ? (
            <Alert tone={shellNotice.tone} className="mb-4">
              {shellNotice.message}
            </Alert>
          ) : null}
          {gateContent}
        </main>
      </div>

      <ConfirmDialog
        open={returnConfirmOpen}
        title={t("returnLeadsTitle")}
        description={t("returnLeadsConfirm")}
        confirmLabel={t("returnLeads")}
        tone="warning"
        busy={returningLeads}
        onConfirm={confirmReturnOpenLeads}
        onClose={() => setReturnConfirmOpen(false)}
      />
      {canRunDemoTour ? (
        <DemoTour profile={profile} />
      ) : null}
    </div>
  );
}
