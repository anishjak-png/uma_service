"use client";

export const JOBS_PAGE_SIZE = 25;

type JobListPaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function JobListPagination({
  page,
  totalPages,
  total,
  onPageChange,
}: JobListPaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * JOBS_PAGE_SIZE + 1;
  const end = Math.min(page * JOBS_PAGE_SIZE, total);

  return (
    <nav
      className="mt-3 space-y-2"
      aria-label="Job list pages"
    >
      <p className="text-center text-xs text-slate-500">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Prev
        </button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => onPageChange(pageNumber)}
              aria-current={pageNumber === page ? "page" : undefined}
              className={`min-w-[2rem] rounded-md px-2.5 py-1.5 text-xs font-medium ${
                pageNumber === page
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {pageNumber}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
