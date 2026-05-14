import type { LucideIcon } from "lucide-react";

type StatTileProps = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: "sky" | "leaf" | "solar" | "danger" | "warn";
};

const toneClasses = {
  sky: "bg-sky/10 text-sky",
  leaf: "bg-leaf/10 text-leaf",
  solar: "bg-solar/20 text-[#8a5a00]",
  danger: "bg-danger/10 text-danger",
  warn: "bg-warn/10 text-warn"
};

export function StatTile({ label, value, icon: Icon, tone = "sky" }: StatTileProps) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted">{label}</div>
          <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
        </div>
        <div className={`rounded-lg p-2 ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
