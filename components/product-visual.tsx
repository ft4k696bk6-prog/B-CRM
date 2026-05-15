import { BatteryCharging, Cpu, Droplets, PanelsTopLeft } from "lucide-react";

type ProductVisualProps = {
  type: "panel" | "inverter" | "battery" | "rainwater";
  title: string;
  subtitle: string;
};

export function ProductVisual({ type, title, subtitle }: ProductVisualProps) {
  const Icon =
    type === "panel"
      ? PanelsTopLeft
      : type === "inverter"
        ? Cpu
        : type === "rainwater"
          ? Droplets
          : BatteryCharging;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
      <div className="relative min-h-36 bg-[#eef3f8] p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(244,183,64,0.25),transparent_28%),radial-gradient(circle_at_90%_15%,rgba(56,152,204,0.18),transparent_30%)]" />
        <div className="relative z-10 flex h-full min-h-28 items-center justify-center">
          {type === "panel" ? <PanelRender /> : null}
          {type === "inverter" ? <InverterRender /> : null}
          {type === "battery" ? <BatteryRender /> : null}
          {type === "rainwater" ? <RainwaterRender /> : null}
        </div>
      </div>
      <div className="border-t border-line p-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-md bg-ink text-white">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-black text-ink">{title}</div>
            <div className="mt-0.5 text-xs text-muted">{subtitle}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelRender() {
  return (
    <div className="grid w-36 grid-cols-5 gap-1 rounded-md bg-[#0d1b33] p-2 shadow-xl ring-4 ring-[#172033]/15">
      {Array.from({ length: 20 }).map((_, index) => (
        <span
          key={index}
          className="h-8 rounded-[2px] bg-gradient-to-br from-[#163765] via-[#1f4f92] to-[#0b203f] ring-1 ring-white/10"
        />
      ))}
    </div>
  );
}

function InverterRender() {
  return (
    <div className="w-36 rounded-xl bg-gradient-to-b from-white to-[#dce4ec] p-4 shadow-xl ring-1 ring-black/10">
      <div className="mb-3 h-4 rounded-full bg-[#243041]" />
      <div className="rounded-lg bg-[#1e293b] p-3 text-center text-[10px] font-black text-solar">
        DEYE
      </div>
      <div className="mt-4 grid grid-cols-4 gap-1">
        {Array.from({ length: 8 }).map((_, index) => (
          <span key={index} className="h-2 rounded-full bg-[#9aa8b7]" />
        ))}
      </div>
    </div>
  );
}

function BatteryRender() {
  return (
    <div className="grid w-40 gap-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg bg-gradient-to-r from-[#1c3031] via-[#244d3a] to-[#1c3031] px-4 py-3 shadow-lg ring-1 ring-white/10"
        >
          <div className="h-2 w-16 rounded-full bg-leaf" />
          <div className="mt-2 h-1.5 rounded-full bg-white/20" />
        </div>
      ))}
    </div>
  );
}

function RainwaterRender() {
  return (
    <div className="relative h-32 w-40">
      <div className="absolute bottom-0 left-3 right-3 h-24 rounded-b-3xl rounded-t-xl bg-gradient-to-b from-[#78bee8] to-[#2d7aa8] shadow-xl" />
      <div className="absolute left-8 right-8 top-0 h-12 rounded-full bg-[#bde5f8] shadow-inner" />
      <div className="absolute left-12 top-10 h-10 w-3 rounded-full bg-white/50" />
      <div className="absolute right-10 top-14 h-8 w-3 rounded-full bg-white/35" />
    </div>
  );
}

