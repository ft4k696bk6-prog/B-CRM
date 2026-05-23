import type { ContractCustomerRecord } from "@/lib/contract-documents";
import type { Profile } from "@/lib/types";

export type FinanceSimulation = {
  amount: number;
  ownPayment: number;
  subsidy: number;
  months: number;
  annualRate: number;
  monthlyInstallment: number;
  totalCost: number;
  updatedAt: string | null;
};

export type AccountingDocumentState = {
  packagePreparedAt: string | null;
  invoicePreviewAt: string | null;
  ksefPayloadAt: string | null;
  annexGeneratedAt: string | null;
};

export type WarehouseDocument = {
  pzNumber: string | null;
  pzGeneratedAt: string | null;
  wzNumber: string | null;
  wzReservedAt: string | null;
  finalWzNumber: string | null;
  finalWzGeneratedAt: string | null;
};

export type LogisticsPlan = {
  deliveryDate: string;
  crew: string;
  status: "draft" | "scheduled" | "ready";
  notes: string;
  updatedAt: string | null;
};

export type InstallationCloseout = {
  installationDate: string;
  roofPhotos: boolean;
  inverterConfigured: boolean;
  clientSigned: boolean;
  finalDocumentsReady: boolean;
  updatedAt: string | null;
};

export type DepartmentProcessState = {
  finance: FinanceSimulation;
  accounting: AccountingDocumentState;
  warehouse: WarehouseDocument;
  logistics: LogisticsPlan;
  installation: InstallationCloseout;
};

export function departmentStateStorageKeyFor(
  profile: Pick<Profile, "id" | "crm_environment">,
  processId: string
) {
  return `bcrm-department-state:${profile.crm_environment}:${profile.id}:${processId}`;
}

export function parseMoneyValue(value: string | null | undefined) {
  if (!value) return 0;
  const normalized = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  return Number(normalized) || 0;
}

export function calculateFinanceSimulation(
  amount: number,
  ownPayment: number,
  subsidy: number,
  months: number,
  annualRate: number
) {
  const principal = Math.max(amount - ownPayment - subsidy, 0);
  const safeMonths = Math.max(months, 1);
  const interest = principal * ((safeMonths / 12) * (Math.max(annualRate, 0) / 100));
  const totalCost = principal + interest;

  return {
    monthlyInstallment: totalCost / safeMonths,
    totalCost
  };
}

export function defaultDepartmentState(contract: ContractCustomerRecord): DepartmentProcessState {
  const amount = parseMoneyValue(contract.grossPrice);
  const months = 120;
  const annualRate = 6.5;
  const simulation = calculateFinanceSimulation(amount, 0, 0, months, annualRate);

  return {
    finance: {
      amount,
      ownPayment: 0,
      subsidy: 0,
      months,
      annualRate,
      monthlyInstallment: simulation.monthlyInstallment,
      totalCost: simulation.totalCost,
      updatedAt: null
    },
    accounting: {
      packagePreparedAt: null,
      invoicePreviewAt: null,
      ksefPayloadAt: null,
      annexGeneratedAt: null
    },
    warehouse: {
      pzNumber: null,
      pzGeneratedAt: null,
      wzNumber: null,
      wzReservedAt: null,
      finalWzNumber: null,
      finalWzGeneratedAt: null
    },
    logistics: {
      deliveryDate: contract.montageDate,
      crew: "Ekipa A",
      status: "draft",
      notes: "",
      updatedAt: null
    },
    installation: {
      installationDate: contract.montageDate,
      roofPhotos: false,
      inverterConfigured: false,
      clientSigned: false,
      finalDocumentsReady: false,
      updatedAt: null
    }
  };
}

export function normalizeDepartmentState(
  state: Partial<DepartmentProcessState> | null | undefined,
  contract: ContractCustomerRecord
): DepartmentProcessState {
  const base = defaultDepartmentState(contract);
  const finance = { ...base.finance, ...state?.finance };
  const recalculated = calculateFinanceSimulation(
    finance.amount,
    finance.ownPayment,
    finance.subsidy,
    finance.months,
    finance.annualRate
  );

  return {
    finance: {
      ...finance,
      monthlyInstallment: recalculated.monthlyInstallment,
      totalCost: recalculated.totalCost
    },
    accounting: { ...base.accounting, ...state?.accounting },
    warehouse: { ...base.warehouse, ...state?.warehouse },
    logistics: { ...base.logistics, ...state?.logistics },
    installation: { ...base.installation, ...state?.installation }
  };
}

export function readDepartmentState(storageKey: string, contract: ContractCustomerRecord) {
  if (typeof window === "undefined") return defaultDepartmentState(contract);

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaultDepartmentState(contract);
    return normalizeDepartmentState(JSON.parse(raw) as Partial<DepartmentProcessState>, contract);
  } catch {
    return defaultDepartmentState(contract);
  }
}

export function saveDepartmentState(storageKey: string, state: DepartmentProcessState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

export function documentNumber(prefix: string, contractNumber: string, date = new Date()) {
  const safeContract = contractNumber.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}/${stamp}/${safeContract || "BCRM"}`;
}
