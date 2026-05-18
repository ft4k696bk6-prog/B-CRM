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
    <div className="min-h-[122px] rounded-lg border border-line bg-white p-4 shadow-sm transition hover:-translate-y-px hover:border-[#c7d1df] hover:shadow-soft sm:p-5">
      <div className="grid h-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold leading-5 text-muted">{label}</div>
          <div className="mt-5 text-3xl font-black leading-none tracking-tight text-ink">{value}</div>
        </div>
        <div
          className={`flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-line bg-[#f8fafc] ${toneClasses[tone]}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
