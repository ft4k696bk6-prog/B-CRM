"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  BookOpenCheck,
  Calculator,
  CalendarDays,
  Landmark,
  LogOut,
  Menu,
  PanelLeft,
  RotateCcw,
  Settings,
  UserPlus,
  X,
  type LucideIcon
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { useLanguage } from "@/components/language-provider";
import { Alert, ConfirmDialog } from "@/components/ui";
import { hasAnyPermission } from "@/lib/permissions";
import type { Permission } from "@/lib/permissions";
import { homePathForRole, isSalesRole, isSystemAdminRole, ROLE_LABELS } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import type { Profile, UserRole } from "@/lib/types";

type AppShellProps = {
  profile: Profile;
  children: ReactNode;
};

type NavigationLink = {
  href: string;
  labelKey:
    | "navDashboard"
    | "navTeamDashboard"
    | "navMyLeads"
    | "navNewLead"
    | "navCalendar"
    | "navCalculators"
    | "navMaterials"
    | "navSettings"
    | "navUsers";
  groupKey: "main" | "sales" | "company";
  icon: LucideIcon;
  permissions?: Permission[];
  allowedRoles?: UserRole[];
  hideWhenAnyPermission?: Permission[];
  salesOnly?: boolean;
  tourId?: string;
};

const bulkReturnStatuses = [
  "Nowy",
  "Przypisany",
  "Nie odebrał",
  "Błędny numer",
  "Do weryfikacji",
  "Po spotkaniu"
];

const navigationLinks: NavigationLink[] = [
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
  { href: "/calendar", labelKey: "navCalendar", groupKey: "company", icon: CalendarDays, permissions: ["calendar:view"] },
  { href: "/calculators", labelKey: "navCalculators", groupKey: "company", icon: Calculator, permissions: ["offers:calculate"], tourId: "tour-nav-calculators" },
  { href: "/materials", labelKey: "navMaterials", groupKey: "company", icon: BookOpenCheck, allowedRoles: ["owner", "admin", "kierownik", "handlowiec"] },
  { href: "/settings", labelKey: "navSettings", groupKey: "company", icon: Settings, permissions: ["settings:view"] },
  { href: "/admin/users", labelKey: "navUsers", groupKey: "company", icon: Landmark, permissions: ["users:manage"] }
];

const navigationGroups: Array<{ key: NavigationLink["groupKey"]; labelKey: "navGroupMain" | "navGroupSales" | "navGroupCompany" }> = [
  { key: "main", labelKey: "navGroupMain" },
  { key: "sales", labelKey: "navGroupSales" },
  { key: "company", labelKey: "navGroupCompany" }
];

export function AppShell({ profile, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [returningLeads, setReturningLeads] = useState(false);
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [shellNotice, setShellNotice] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const homeHref = homePathForRole(profile.role);
  const roleLabel = ROLE_LABELS[profile.role];
  const links = navigationLinks.filter((link) => {
    if (link.salesOnly && !isSalesRole(profile.role)) return false;
    if (link.hideWhenAnyPermission && hasAnyPermission(profile.role, link.hideWhenAnyPermission)) return false;
    if (link.allowedRoles && !link.allowedRoles.includes(profile.role) && !isSystemAdminRole(profile.role)) return false;
    if (link.permissions) return hasAnyPermission(profile.role, link.permissions);
    return true;
  });
  const bottomNav = [
    links.find((link) => link.href === homeHref) || links[0],
    links.find((link) => link.href === "/calendar"),
    links.find((link) => link.href === "/calculators"),
    links.find((link) => link.href === "/materials")
  ].filter(Boolean) as NavigationLink[];

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function confirmReturnOpenLeads() {
    if (!isSalesRole(profile.role) || returningLeads) return;

    setReturningLeads(true);
    setShellNotice(null);

    const { data, error } = await supabase
      .from("leads")
      .update({ status: "Zwrot", assigned_to: null })
      .eq("assigned_to", profile.id)
      .eq("crm_environment", profile.crm_environment)
      .in("status", bulkReturnStatuses)
      .select("id");

    setReturningLeads(false);

    if (error) {
      setShellNotice({ tone: "danger", message: error.message });
      return;
    }

    setReturnConfirmOpen(false);
    setShellNotice({
      tone: "success",
      message: `Zwrócono leady: ${data?.length || 0}`
    });
    window.dispatchEvent(new Event("leads:changed"));
    router.replace(homePathForRole(profile.role));
    router.refresh();
  }

  function renderNavigation(closeOnClick = false) {
    return (
      <nav className="grid gap-4">
        {navigationGroups.map((group) => {
          const groupLinks = links.filter((link) => link.groupKey === group.key);
          if (groupLinks.length === 0) return null;

          return (
            <div key={group.key} className="grid gap-1">
              <div className="px-2 text-[11px] font-black uppercase tracking-wide text-muted">
                {t(group.labelKey)}
              </div>
              {groupLinks.map((link) => {
                const Icon = link.icon;
                const active = pathname === link.href;

                return (
                  <Link
                    key={`${link.href}-${link.labelKey}`}
                    href={link.href}
                    data-tour-id={link.tourId}
                    onClick={() => closeOnClick && setMobileOpen(false)}
                    className={`relative flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-bold transition ${
                      active
                        ? "bg-ink text-white shadow-[0_12px_22px_rgba(18,24,37,0.16)]"
                        : "text-muted hover:bg-[#eef3f8] hover:text-ink"
                    }`}
                  >
                    {active ? (
                      <span className="absolute left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-solar" aria-hidden="true" />
                    ) : null}
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {t(link.labelKey)}
                  </Link>
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
      <header className="sticky top-0 z-30 border-b border-line bg-white/88 shadow-[0_10px_30px_rgba(18,24,37,0.045)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1520px] items-center justify-between gap-4 px-4 py-3">
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
                </span>
                <span className="block truncate text-xs text-muted">
                  {t("panelPrefix")}: {roleLabel}
                </span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-md border border-line bg-[#f8fafc] px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] sm:block">
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
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#101722]/55 backdrop-blur-sm"
            aria-label="Zamknij menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[min(88vw,340px)] flex-col border-r border-line bg-white/96 p-3 shadow-soft backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <BrandMark size="sm" />
                <div>
                  <div className="flex items-center gap-2 text-sm font-black text-ink">
                    B-CRM
                  </div>
                  <div className="text-xs text-muted">{roleLabel}</div>
                </div>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} className="btn-icon" aria-label="Zamknij menu">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mb-2 flex items-center gap-2 px-2 py-2 text-xs font-bold uppercase tracking-wide text-muted">
              <PanelLeft className="h-4 w-4" aria-hidden="true" />
              {t("menu")}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{renderNavigation(true)}</div>
          </aside>
        </div>
      ) : null}

      <div className="app-layout mx-auto grid max-w-[1520px] gap-5 px-4 py-5 pb-24 lg:grid-cols-[260px_minmax(0,1fr)] lg:pb-5">
        <aside className="app-sidebar hidden rounded-lg border border-line bg-white/92 p-2 shadow-[0_18px_44px_rgba(18,24,37,0.065)] backdrop-blur-xl lg:sticky lg:top-20 lg:block lg:h-fit">
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
          {children}
        </main>
      </div>

      {bottomNav.length > 0 ? (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-10px_28px_rgba(16,23,34,0.08)] backdrop-blur lg:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
            {bottomNav.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;

              return (
                <Link
                  key={`bottom-${link.href}-${link.labelKey}`}
                  href={link.href}
                  title={t(link.labelKey)}
                  className={`flex min-h-14 flex-col items-center justify-center rounded-lg px-2 py-1 text-[11px] font-black transition ${
                    active ? "bg-ink text-white" : "text-muted hover:bg-[#eef3f8] hover:text-ink"
                  }`}
                >
                  <Icon className="mb-0.5 h-5 w-5" aria-hidden="true" />
                  <span className="max-w-full truncate">{t(link.labelKey)}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

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
    </div>
  );
}
