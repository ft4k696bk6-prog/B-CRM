"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  Calculator,
  CalendarDays,
  FileUp,
  FolderKanban,
  LogOut,
  Menu,
  PanelLeft,
  RotateCcw,
  Settings,
  UserPlus,
  UsersRound,
  X,
  type LucideIcon
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Alert, ConfirmDialog } from "@/components/ui";
import { hasAnyPermission } from "@/lib/permissions";
import type { Permission } from "@/lib/permissions";
import { homePathForRole, isSalesRole, ROLE_LABELS } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

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
    | "navOperations"
    | "navNewLead"
    | "navCalendar"
    | "navCalculators"
    | "navSettings"
    | "navImport"
    | "navUsers";
  icon: LucideIcon;
  permissions: Permission[];
  hideWhenAnyPermission?: Permission[];
  salesOnly?: boolean;
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
  { href: "/admin", labelKey: "navDashboard", icon: BarChart3, permissions: ["dashboard:view:all"] },
  {
    href: "/admin",
    labelKey: "navTeamDashboard",
    icon: BarChart3,
    permissions: ["dashboard:view:team"],
    hideWhenAnyPermission: ["dashboard:view:all"]
  },
  {
    href: "/sales",
    labelKey: "navMyLeads",
    icon: BarChart3,
    permissions: ["dashboard:view:own"],
    salesOnly: true
  },
  { href: "/realizacja", labelKey: "navOperations", icon: FolderKanban, permissions: ["operations:view"] },
  { href: "/leads/new", labelKey: "navNewLead", icon: UserPlus, permissions: ["leads:create:own", "leads:create:pool"] },
  { href: "/calendar", labelKey: "navCalendar", icon: CalendarDays, permissions: ["calendar:view"] },
  { href: "/calculators", labelKey: "navCalculators", icon: Calculator, permissions: ["offers:calculate"] },
  { href: "/settings", labelKey: "navSettings", icon: Settings, permissions: ["settings:view"] },
  { href: "/admin/import", labelKey: "navImport", icon: FileUp, permissions: ["data:import"] },
  { href: "/admin/users", labelKey: "navUsers", icon: UsersRound, permissions: ["users:manage"] }
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

export function AppShell({ profile, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [returningLeads, setReturningLeads] = useState(false);
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [shellNotice, setShellNotice] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const homeHref = homePathForRole(profile.role);
  const roleLabel = language === "en" ? roleLabelsEn[profile.role] : ROLE_LABELS[profile.role];
  const links = navigationLinks.filter((link) => {
    if (link.salesOnly && !isSalesRole(profile.role)) return false;
    if (link.hideWhenAnyPermission && hasAnyPermission(profile.role, link.hideWhenAnyPermission)) return false;
    return hasAnyPermission(profile.role, link.permissions);
  });

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
      message: language === "en" ? `Returned leads: ${data?.length || 0}` : `Zwrócono leady: ${data?.length || 0}`
    });
    window.dispatchEvent(new Event("leads:changed"));
    router.replace(homePathForRole(profile.role));
    router.refresh();
  }

  function renderNavigation(closeOnClick = false) {
    return (
      <nav className="grid gap-1">
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href;

          return (
            <Link
              key={`${link.href}-${link.labelKey}`}
              href={link.href}
              onClick={() => closeOnClick && setMobileOpen(false)}
              className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-bold transition ${
                active
                  ? "bg-ink text-white shadow-sm"
                  : "text-muted hover:bg-[#eef3f8] hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t(link.labelKey)}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
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
                <span className="block text-sm font-bold leading-4">B-CRM</span>
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
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
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
          <aside className="relative flex h-full w-[min(88vw,340px)] flex-col border-r border-line bg-white p-3 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <BrandMark size="sm" />
                <div>
                  <div className="text-sm font-black text-ink">B-CRM</div>
                  <div className="text-xs text-muted">{roleLabel}</div>
                </div>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} className="btn-icon" aria-label="Zamknij menu">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mb-3 md:hidden">
              <LanguageSwitcher />
            </div>
            <div className="mb-2 flex items-center gap-2 px-2 py-2 text-xs font-bold uppercase tracking-wide text-muted">
              <PanelLeft className="h-4 w-4" aria-hidden="true" />
              {t("menu")}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{renderNavigation(true)}</div>
          </aside>
        </div>
      ) : null}

      <div className="app-layout mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[230px_1fr]">
        <aside className="app-sidebar hidden rounded-lg border border-line bg-white p-2 shadow-sm lg:sticky lg:top-20 lg:block lg:h-fit">
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
