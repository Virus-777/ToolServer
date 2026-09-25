import React from 'react';
import { Select } from './ui';

const MAX_VISIBLE_PAGES = 5;

const pageButtonClass = (active) =>
  `rounded-md border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
    active ? 'border-primary bg-primary text-white' : 'border-gray-300 hover:bg-gray-50'
  }`;

/**
 * Pager with "Showing x–y of z", First/Prev/[pages]/Next/Last and a page-size selector.
 */
const Pagination = ({
  page,
  totalPages,
  total,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
}) => {
  if (!total) return null;

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  let startPage = Math.max(1, page - Math.floor(MAX_VISIBLE_PAGES / 2));
  const endPage = Math.min(totalPages, startPage + MAX_VISIBLE_PAGES - 1);
  if (endPage - startPage + 1 < MAX_VISIBLE_PAGES) {
    startPage = Math.max(1, endPage - MAX_VISIBLE_PAGES + 1);
  }
  const pages = Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);

  const goTo = (target) => {
    if (target >= 1 && target <= totalPages && target !== page) onPageChange(target);
  };

  return (
    <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
      <div className="text-sm text-gray-600">
        Showing <span className="font-medium">{startItem}</span>–<span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{total}</span>
      </div>

      <nav className="flex flex-wrap items-center gap-1" aria-label="Pagination">
        <button type="button" onClick={() => goTo(1)} disabled={page === 1} className={pageButtonClass(false)}>First</button>
        <button type="button" onClick={() => goTo(page - 1)} disabled={page === 1} className={pageButtonClass(false)}>Previous</button>
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => goTo(pageNumber)}
            aria-current={pageNumber === page ? 'page' : undefined}
            className={pageButtonClass(pageNumber === page)}
          >
            {pageNumber}
          </button>
        ))}
        <button type="button" onClick={() => goTo(page + 1)} disabled={page >= totalPages} className={pageButtonClass(false)}>Next</button>
        <button type="button" onClick={() => goTo(totalPages)} disabled={page >= totalPages} className={pageButtonClass(false)}>Last</button>
      </nav>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        Per page
        <Select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} size="sm" fullWidth={false}>
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </Select>
      </label>
    </div>
  );
};

export default Pagination;
