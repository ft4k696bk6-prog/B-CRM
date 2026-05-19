"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isDemoScope } from "@/lib/scope";
import { supabase } from "@/lib/supabase";
import type { Lead, Profile } from "@/lib/types";
import {
  demoProcessClient,
  leadToProcessClient,
  readSelectedProcessId,
  readStoredWorkflows,
  saveSelectedProcessId,
  saveStoredWorkflows,
  selectedProcessStorageKeyFor,
  toggleWorkflowStatus,
  workflowForProcess,
  workflowStorageKeyFor,
  type ProcessClient,
  type WorkflowKey,
  type WorkflowMap
} from "@/lib/process-workspace";

type ProcessWorkspaceState = {
  loading: boolean;
  error: string;
  processClients: ProcessClient[];
  selectedProcess: ProcessClient;
  selectedWorkflow: WorkflowMap;
  workflowByProcess: Record<string, WorkflowMap>;
  hasProcessClients: boolean;
  selectProcess: (processId: string) => void;
  moveWorkflow: (step: WorkflowKey) => void;
  reload: () => Promise<void>;
};

export function useProcessWorkspace(profile: Profile | null): ProcessWorkspaceState {
  const [processLeads, setProcessLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedProcessId, setSelectedProcessId] = useState(demoProcessClient().id);
  const [workflowByProcess, setWorkflowByProcess] = useState<Record<string, WorkflowMap>>({});

  const processClients = useMemo<ProcessClient[]>(() => {
    const clients = processLeads.map(leadToProcessClient);
    if (clients.length > 0) return clients;
    return profile && isDemoScope(profile.crm_environment) ? [demoProcessClient()] : [];
  }, [processLeads, profile]);

  const selectedProcess = processClients.find((client) => client.id === selectedProcessId) || processClients[0] || demoProcessClient();
  const selectedWorkflow = workflowForProcess(selectedProcess, workflowByProcess);
  const hasProcessClients = processClients.length > 0;

  const loadProcesses = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    setError("");

    let query = supabase
      .from("leads")
      .select("*, assigned_profile:profiles!leads_assigned_to_fkey(id,email,full_name,role,crm_environment)")
      .eq("crm_environment", profile.crm_environment)
      .or("status.eq.Umowa,contract_number.not.is.null")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (profile.role === "handlowiec") {
      query = query.eq("assigned_to", profile.id);
    }

    const { data, error: processError } = await query;

    if (processError) {
      setError(processError.message);
      setProcessLeads([]);
    } else {
      setProcessLeads((data || []) as Lead[]);
    }

    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    setWorkflowByProcess(readStoredWorkflows(workflowStorageKeyFor(profile)));
    setSelectedProcessId(readSelectedProcessId(selectedProcessStorageKeyFor(profile)) || demoProcessClient().id);
    void loadProcesses();
  }, [loadProcesses, profile]);

  useEffect(() => {
    if (!profile || processClients.length === 0) return;

    setSelectedProcessId((current) => {
      if (processClients.some((client) => client.id === current)) return current;
      const next = processClients[0].id;
      saveSelectedProcessId(selectedProcessStorageKeyFor(profile), next);
      return next;
    });
  }, [processClients, profile]);

  const selectProcess = useCallback((processId: string) => {
    if (!profile) return;
    setSelectedProcessId(processId);
    saveSelectedProcessId(selectedProcessStorageKeyFor(profile), processId);
  }, [profile]);

  const moveWorkflow = useCallback((step: WorkflowKey) => {
    if (!profile || !hasProcessClients) return;

    setWorkflowByProcess((current) => {
      const next = {
        ...current,
        [selectedProcess.id]: toggleWorkflowStatus(workflowForProcess(selectedProcess, current), step)
      };
      saveStoredWorkflows(workflowStorageKeyFor(profile), next);
      return next;
    });
  }, [hasProcessClients, profile, selectedProcess]);

  return {
    loading,
    error,
    processClients,
    selectedProcess,
    selectedWorkflow,
    workflowByProcess,
    hasProcessClients,
    selectProcess,
    moveWorkflow,
    reload: loadProcesses
  };
}

