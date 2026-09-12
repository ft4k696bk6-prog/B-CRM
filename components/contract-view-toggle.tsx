"use client";

import { LayoutList, Rows3 } from "lucide-react";

export function ContractViewToggle({ showingLegacy, onToggle }: { showingLegacy: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="btn-secondary" onClick={onToggle} aria-label={showingLegacy ? "Przełącz na nowy widok umów" : "Przełącz na stary widok umów"}>
      {showingLegacy ? <Rows3 className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
      {showingLegacy ? "Nowy widok" : "Stary widok"}
    </button>
  );
}
