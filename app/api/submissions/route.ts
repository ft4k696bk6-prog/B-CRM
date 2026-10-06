import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { requireApiProfile } from "@/lib/server-auth";

const SUBMISSION_TASK_KEYS = ["zglosic_pge", "zglosic_dotacje"] as const;
type SubmissionTaskKey = (typeof SUBMISSION_TASK_KEYS)[number];

type SubmissionTaskRow = {
  id: string;
  contract_id: string;
  task_key: SubmissionTaskKey;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  updated_at: string;
};

function isSubmissionTaskKey(value: unknown): value is SubmissionTaskKey {
  return typeof value === "string" && SUBMISSION_TASK_KEYS.includes(value as SubmissionTaskKey);
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if (auth.error) return auth.error;
    if (!hasPermission(auth.profile.role, "submissions:view")) {
      return NextResponse.json({ error: "Brak dostępu do zgłoszeń." }, { status: 403 });
    }

    const { data: workflows, error: workflowError } = await auth.supabaseAdmin
      .from("contract_workflow")
      .select("contract_id")
      .eq("settled", true);

    if (workflowError) return NextResponse.json({ error: workflowError.message }, { status: 400 });
    const settledIds = (workflows || []).map((row) => row.contract_id as string);
    if (settledIds.length === 0) return NextResponse.json({ submissions: [] });

    const { data: contracts, error: contractsError } = await auth.supabaseAdmin
      .from("contracts")
      .select("id,contract_number,customer_name,phone,email,postal_code,city,street,house_number,created_at,submitted_at,process_status")
      .eq("crm_environment", auth.profile.crm_environment)
      .eq("submission_status", "submitted")
      .in("id", settledIds)
      .order("created_at", { ascending: false });

    if (contractsError) return NextResponse.json({ error: contractsError.message }, { status: 400 });
    const contractIds = (contracts || []).map((contract) => contract.id as string);
    if (contractIds.length === 0) return NextResponse.json({ submissions: [] });

    const { data: tasks, error: tasksError } = await auth.supabaseAdmin
      .from("contract_tasks")
      .select("id,contract_id,task_key,completed,completed_at,completed_by,updated_at")
      .in("contract_id", contractIds)
      .in("task_key", [...SUBMISSION_TASK_KEYS]);

    if (tasksError) return NextResponse.json({ error: tasksError.message }, { status: 400 });

    const taskRows = (tasks || []) as SubmissionTaskRow[];
    const actorIds = Array.from(new Set(taskRows.map((task) => task.completed_by).filter(Boolean))) as string[];
    const actorNames = new Map<string, string>();

    if (actorIds.length > 0) {
      const { data: actors } = await auth.supabaseAdmin
        .from("profiles")
        .select("id,full_name")
        .eq("crm_environment", auth.profile.crm_environment)
        .in("id", actorIds);
      (actors || []).forEach((actor) => actorNames.set(actor.id as string, actor.full_name as string));
    }

    const tasksByContract = new Map<string, SubmissionTaskRow[]>();
    taskRows.forEach((task) => {
      const current = tasksByContract.get(task.contract_id) || [];
      current.push(task);
      tasksByContract.set(task.contract_id, current);
    });

    const submissions = (contracts || []).map((contract) => {
      const contractTasks = tasksByContract.get(contract.id as string) || [];
      const buildTask = (taskKey: SubmissionTaskKey) => {
        const task = contractTasks.find((item) => item.task_key === taskKey);
        return {
          key: taskKey,
          completed: Boolean(task?.completed),
          completedAt: task?.completed_at || null,
          completedBy: task?.completed_by || null,
          completedByName: task?.completed_by ? actorNames.get(task.completed_by) || null : null
        };
      };

      return {
        ...contract,
        pge: buildTask("zglosic_pge"),
        subsidy: buildTask("zglosic_dotacje")
      };
    });

    return NextResponse.json({ submissions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się pobrać zgłoszeń." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireApiProfile(request);
    if (auth.error) return auth.error;
    if (!hasPermission(auth.profile.role, "submissions:manage")) {
      return NextResponse.json({ error: "Brak uprawnień do aktualizacji zgłoszeń." }, { status: 403 });
    }

    const body = (await request.json()) as {
      contractId?: unknown;
      taskKey?: unknown;
      completed?: unknown;
    };
    const contractId = typeof body.contractId === "string" ? body.contractId : "";
    if (!contractId || !isSubmissionTaskKey(body.taskKey) || typeof body.completed !== "boolean") {
      return NextResponse.json({ error: "Niepoprawne dane zgłoszenia." }, { status: 400 });
    }

    const { data: contract, error: contractError } = await auth.supabaseAdmin
      .from("contracts")
      .select("id")
      .eq("id", contractId)
      .eq("crm_environment", auth.profile.crm_environment)
      .eq("submission_status", "submitted")
      .maybeSingle();

    if (contractError) return NextResponse.json({ error: contractError.message }, { status: 400 });
    if (!contract) return NextResponse.json({ error: "Nie znaleziono umowy." }, { status: 404 });

    const { data: workflow, error: workflowError } = await auth.supabaseAdmin
      .from("contract_workflow")
      .select("settled")
      .eq("contract_id", contractId)
      .maybeSingle();

    if (workflowError) return NextResponse.json({ error: workflowError.message }, { status: 400 });
    if (!workflow?.settled) {
      return NextResponse.json({ error: "Zgłoszenia są dostępne dopiero po oznaczeniu umowy jako Rozliczona." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { data: task, error: taskError } = await auth.supabaseAdmin
      .from("contract_tasks")
      .upsert(
        {
          contract_id: contractId,
          task_key: body.taskKey,
          completed: body.completed,
          completed_at: body.completed ? now : null,
          completed_by: body.completed ? auth.profile.id : null,
          updated_at: now
        },
        { onConflict: "contract_id,task_key" }
      )
      .select("id,contract_id,task_key,completed,completed_at,completed_by,updated_at")
      .single();

    if (taskError) return NextResponse.json({ error: taskError.message }, { status: 400 });

    return NextResponse.json({
      task: {
        ...task,
        completedByName: task.completed_by ? auth.profile.full_name : null
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się zapisać zgłoszenia." },
      { status: 500 }
    );
  }
}
