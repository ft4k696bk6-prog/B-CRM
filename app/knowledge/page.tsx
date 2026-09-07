"use client";

import { AppShell } from "@/components/app-shell";
import { KnowledgeAssetsBrowser } from "@/components/knowledge-assets-browser";
import { LoadingScreen } from "@/components/loading-screen";
import { PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/use-auth";

export default function KnowledgePage() {
  const { loading, profile, session } = useAuth();
  if (loading || !profile) return <LoadingScreen />;

  const canEdit = profile.role === "owner" || profile.role === "admin";

  return (
    <AppShell profile={profile}>
      <div className="grid min-w-0 gap-5">
        <PageHeader
          title="Skarbnica wiedzy"
          description="Zdjęcia, realizacje, dokumenty, wzory i materiały sprzedażowe."
        />
        {session?.access_token ? (
          <KnowledgeAssetsBrowser accessToken={session.access_token} canEdit={canEdit} />
        ) : null}
      </div>
    </AppShell>
  );
}
