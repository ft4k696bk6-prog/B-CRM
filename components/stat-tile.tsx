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
    <div className="min-h-[124px] overflow-hidden rounded-lg border border-line bg-white p-4 shadow-sm transition hover:-translate-y-px hover:border-[#c7d1df] hover:shadow-soft sm:p-5">
      <div className="flex h-full min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch">
          <div className="min-h-10 break-words text-sm font-bold leading-5 text-muted">{label}</div>
          <div className="mt-4 text-3xl font-black leading-none tracking-tight text-ink">{value}</div>
        </div>
        <div
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-line bg-[#f8fafc] ${toneClasses[tone]}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
