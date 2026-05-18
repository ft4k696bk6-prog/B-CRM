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
    <div className="relative min-h-[118px] overflow-hidden rounded-lg border border-line bg-white p-4 pr-16 shadow-sm transition hover:-translate-y-px hover:border-[#c7d1df] hover:shadow-soft sm:min-h-[124px] sm:p-5 sm:pr-16">
      <div className="flex h-full min-w-0 flex-col justify-between">
        <div className="min-h-10 max-w-full break-words text-sm font-bold leading-5 text-muted">
          {label}
        </div>
        <div className="mt-5 text-3xl font-black leading-none tracking-tight text-ink">{value}</div>
      </div>
      <div
        className={`absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-[#f8fafc] shadow-[0_10px_22px_rgba(15,23,42,0.05)] ${toneClasses[tone]}`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
    </div>
  );
}
