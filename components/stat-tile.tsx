import type { LucideIcon } from "lucide-react";

type StatTileProps = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: "sky" | "leaf" | "solar" | "danger" | "warn";
};

const toneClasses = {
  sky: "text-sky",
  leaf: "text-leaf",
  solar: "text-[#8a5a00]",
  danger: "text-danger",
  warn: "text-warn"
};

export function StatTile({ label, value, icon: Icon, tone = "sky" }: StatTileProps) {
  return (
    <div className="min-h-[104px] rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="flex h-full items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted">{label}</div>
          <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
        </div>
        <div className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-line bg-[#f9fbfd] ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
