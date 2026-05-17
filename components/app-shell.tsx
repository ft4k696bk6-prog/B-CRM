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
  PanelLeft,
  RotateCcw,
  Settings,
  UserPlus,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
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

export function AppShell({ profile, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const [returningLeads, setReturningLeads] = useState(false);
  const homeHref = homePathForRole(profile.role);
  const links = navigationLinks.filter((link) => {
    if (link.salesOnly && !isSalesRole(profile.role)) return false;
    if (link.hideWhenAnyPermission && hasAnyPermission(profile.role, link.hideWhenAnyPermission)) return false;
    return hasAnyPermission(profile.role, link.permissions);
  });

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function returnOpenLeads() {
    if (!isSalesRole(profile.role) || returningLeads) return;

    const confirmed = window.confirm(
      t("returnLeadsConfirm")
    );

    if (!confirmed) return;

    setReturningLeads(true);

    const { data, error } = await supabase
      .from("leads")
      .update({ status: "Zwrot", assigned_to: null })
      .eq("assigned_to", profile.id)
      .in("status", bulkReturnStatuses)
      .select("id");

    setReturningLeads(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    window.alert(`Zwrócono leady: ${data?.length || 0}`);
    window.dispatchEvent(new Event("leads:changed"));
    router.replace(homePathForRole(profile.role));
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link href={homeHref} className="flex items-center gap-3">
            <BrandMark size="sm" />
              <span>
                <span className="block text-sm font-bold leading-4">B-CRM</span>
              <span className="block text-xs text-muted">
                {t("panelPrefix")}: {ROLE_LABELS[profile.role]}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold">{profile.full_name}</div>
              <div className="text-xs text-muted">{profile.email}</div>
            </div>
            {isSalesRole(profile.role) ? (
              <button
                type="button"
                onClick={returnOpenLeads}
                disabled={returningLeads}
                className="inline-flex h-10 w-10 items-center justify-center gap-2 rounded-md border border-line bg-white text-sm font-semibold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto sm:px-3"
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
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line bg-white text-muted transition hover:border-ink hover:text-ink"
              title={t("signOut")}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="app-layout mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[230px_1fr]">
        <aside className="app-sidebar rounded-lg border border-line bg-white p-2 shadow-sm lg:sticky lg:top-20 lg:h-fit">
          <div className="mb-2 flex items-center gap-2 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
            <PanelLeft className="h-4 w-4" aria-hidden="true" />
            {t("menu")}
          </div>
          <nav className="grid gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;

              return (
                <Link
                  key={`${link.href}-${link.labelKey}`}
                  href={link.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition ${
                    active ? "bg-ink text-white" : "text-muted hover:bg-[#eef3f8] hover:text-ink"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
