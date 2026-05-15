import { BatteryCharging, Cpu, Droplets, Flame, PanelsTopLeft } from "lucide-react";

type ProductVisualProps = {
  type: "panel" | "inverter" | "battery" | "rainwater" | "boiler";
  title: string;
  subtitle: string;
  imageSrc?: string;
};

const fallbackImages: Record<ProductVisualProps["type"], string> = {
  panel: "/products/ja-solar-panel.webp",
  inverter: "/products/deye-inverter.webp",
  battery: "/products/kon-tec-storage.webp",
  rainwater: "/products/rainwater-system.png",
  boiler: "/products/boiler-vertical.png"
};

export function ProductVisual({ type, title, subtitle, imageSrc }: ProductVisualProps) {
  const Icon =
    type === "panel"
      ? PanelsTopLeft
      : type === "inverter"
        ? Cpu
        : type === "rainwater"
          ? Droplets
          : type === "boiler"
            ? Flame
            : BatteryCharging;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
      <div className="flex h-44 items-center justify-center bg-white p-4">
        <img
          src={imageSrc || fallbackImages[type]}
          alt={title}
          className="max-h-full max-w-full object-contain"
        />
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

