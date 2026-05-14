import { LoaderCircle } from "lucide-react";

export function LoadingScreen({ label = "Ładowanie" }: { label?: string }) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <div className="flex items-center gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-muted shadow-sm">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
}
