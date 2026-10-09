import type { ReactNode } from "react";
import { TakebackSettings } from "@/components/admin/takeback-settings";

export default function UsersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="users-page-without-activity">
      {children}
      <TakebackSettings />
      <style>{`
        .users-page-without-activity details.group.app-card:first-of-type {
          display: none;
        }
      `}</style>
    </div>
  );
}
