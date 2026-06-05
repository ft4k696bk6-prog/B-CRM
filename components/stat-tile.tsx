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

const toneSoftClasses = {
  sky: "bg-sky/10",
  leaf: "bg-leaf/10",
  solar: "bg-solar/15",
  danger: "bg-danger/10",
  warn: "bg-warn/10"
};

const toneBarClasses = {
  sky: "bg-sky",
  leaf: "bg-leaf",
  solar: "bg-solar",
  danger: "bg-danger",
  warn: "bg-warn"
};

export function StatTile({ label, value, icon: Icon, tone = "sky" }: StatTileProps) {
  return (
    <div className="group relative min-h-[112px] overflow-hidden rounded-lg border border-line bg-white/95 p-4 shadow-[0_14px_36px_rgba(18,24,37,0.055)] transition hover:-translate-y-px hover:border-[#c7d1df] hover:shadow-soft sm:min-h-[118px] sm:p-5">
      <div className={`absolute inset-x-0 top-0 h-1 ${toneBarClasses[tone]}`} aria-hidden="true" />
      <div className="flex h-full min-w-0 items-start justify-between gap-3">
        <div className="flex min-h-[78px] min-w-0 flex-col justify-between sm:min-h-[82px]">
          <div className="max-w-full break-words text-sm font-bold leading-5 text-muted">
            {label}
          </div>
          <div className="mt-4 text-3xl font-black leading-none tracking-tight tabular-nums text-ink">{value}</div>
        </div>
        <div
          className={`flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-line shadow-[0_10px_22px_rgba(15,23,42,0.05)] transition group-hover:scale-[1.03] ${toneSoftClasses[tone]} ${toneClasses[tone]}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
