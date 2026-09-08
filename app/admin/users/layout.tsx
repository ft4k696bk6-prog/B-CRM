import type { ReactNode } from "react";

export default function UsersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="users-page-without-activity">
      {children}
      <style>{`
        .users-page-without-activity details.group.app-card:first-of-type {
          display: none;
        }
      `}</style>
    </div>
  );
}
