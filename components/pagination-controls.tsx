"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationControlsProps = {
  page: number;
  pageSize: number;
  pageSizeOptions: number[];
  totalItems: number;
  loadedItems: number;
  busy?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function PaginationControls({
  page,
  pageSize,
  pageSizeOptions,
  totalItems,
  loadedItems,
  busy = false,
  onPageChange,
  onPageSizeChange
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const firstItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min((page - 1) * pageSize + loadedItems, totalItems);
  const canGoBack = page > 1;
  const canGoForward = page < totalPages;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted">
        <span className="h-2 w-2 rounded-full bg-leaf" aria-hidden="true" />
        {busy
          ? "Odświeżanie"
          : totalItems === 0
            ? "0 rekordów"
            : `${firstItem}-${lastItem} z ${totalItems} rekordów`}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
          Pokaż
          <select
            className="field min-h-10 w-[86px] px-2 py-1 text-sm"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center overflow-hidden rounded-md border border-line bg-[#f8fafc]">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center text-muted transition hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={!canGoBack || busy}
            aria-label="Poprzednia strona"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="min-w-[82px] border-x border-line px-3 text-center text-sm font-black tabular-nums text-ink">
            {page} / {totalPages}
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center text-muted transition hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={!canGoForward || busy}
            aria-label="Następna strona"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
