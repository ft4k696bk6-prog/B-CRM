"use client";

import { useEffect, useState } from "react";
import { LeadTable as LeadTableV2 } from "@/components/lead-table-v2";
import { supabase } from "@/lib/supabase";
import type { Lead } from "@/lib/types";

type LeadTableProps = {
  leads: Lead[];
  selectable?: boolean;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  showAssignee?: boolean;
  onQuickAction?: (lead: Lead) => void;
  accessToken?: string;
  onChanged?: () => void | Promise<void>;
};

export function LeadTable(props: LeadTableProps) {
  const [sessionToken, setSessionToken] = useState(props.accessToken || "");
  const needsFastActions = Boolean(props.accessToken || props.selectable || props.onQuickAction);

  useEffect(() => {
    if (props.accessToken) {
      setSessionToken(props.accessToken);
      return;
    }
    if (!needsFastActions) {
      setSessionToken("");
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSessionToken(data.session?.access_token || "");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSessionToken(session?.access_token || "");
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [needsFastActions, props.accessToken]);

  return (
    <LeadTableV2
      {...props}
      accessToken={sessionToken}
    />
  );
}
