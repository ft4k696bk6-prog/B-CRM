import { BatteryCharging, Cpu, PanelsTopLeft } from "lucide-react";

type ProductVisualProps = {
  type: "panel" | "inverter" | "battery";
  title: string;
  subtitle: string;
};

export function ProductVisual({ type, title, subtitle }: ProductVisualProps) {
  const Icon = type === "panel" ? PanelsTopLeft : type === "inverter" ? Cpu : BatteryCharging;
  const shell =
    type === "panel"
      ? "from-[#0b1729] via-[#172b4d] to-[#2c3e6f]"
      : type === "inverter"
        ? "from-[#f6f8fb] via-white to-[#e5eaf2]"
        : "from-[#101820] via-[#1c3031] to-[#244d3a]";
  const accent =
    type === "panel" ? "bg-sky" : type === "inverter" ? "bg-solar" : "bg-leaf";

  return (
    <div className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${shell} p-4 text-white shadow-sm`}>
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent" />
      <div className="relative z-10 flex min-h-32 flex-col justify-between">
        <div className="flex items-center justify-between gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent} text-white`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-wide">
            B-CRM
          </span>
        </div>
        <div>
          <div className={`mb-3 grid ${type === "panel" ? "grid-cols-5" : "grid-cols-3"} gap-1`}>
            {Array.from({ length: type === "panel" ? 15 : 6 }).map((_, index) => (
              <span
                key={index}
                className={`h-6 rounded-sm ${
                  type === "inverter" ? "bg-ink/15" : "bg-white/15"
                } ring-1 ring-white/10`}
              />
            ))}
          </div>
          <div className="text-sm font-black">{title}</div>
          <div className="mt-1 text-xs opacity-80">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

