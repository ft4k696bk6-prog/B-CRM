"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  FileUp,
  LogOut,
  PanelLeft,
  UsersRound
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type AppShellProps = {
  profile: Profile;
  children: ReactNode;
};

export function AppShell({ profile, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = profile.role === "admin";
  const links = isAdmin
    ? [
        { href: "/admin", label: "Dashboard", icon: BarChart3 },
        { href: "/admin/import", label: "Import CSV", icon: FileUp },
        { href: "/admin/users", label: "Handlowcy", icon: UsersRound }
      ]
    : [{ href: "/sales", label: "Moje leady", icon: BarChart3 }];

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link href={isAdmin ? "/admin" : "/sales"} className="flex items-center gap-3">
            <BrandMark size="sm" />
            <span>
              <span className="block text-sm font-bold leading-4">B-CRM</span>
              <span className="block text-xs text-muted">
                {isAdmin ? "Panel admina" : "Panel handlowca"}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold">{profile.full_name}</div>
              <div className="text-xs text-muted">{profile.email}</div>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line bg-white text-muted transition hover:border-ink hover:text-ink"
              title="Wyloguj"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[230px_1fr]">
        <aside className="rounded-lg border border-line bg-white p-2 shadow-sm lg:sticky lg:top-20 lg:h-fit">
          <div className="mb-2 flex items-center gap-2 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
            <PanelLeft className="h-4 w-4" aria-hidden="true" />
            Menu
          </div>
          <nav className="grid gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-ink text-white"
                      : "text-muted hover:bg-[#eef3f8] hover:text-ink"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {link.label}
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
