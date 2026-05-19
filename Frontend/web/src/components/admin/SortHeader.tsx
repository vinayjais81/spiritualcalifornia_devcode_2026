'use client';

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

/**
 * Clickable column header that toggles sort by a given column. Used on
 * every admin listing page that supports click-to-sort + drag-to-reorder.
 *
 * Generic over the column-name type so each page can constrain its sort
 * keys to the columns it actually exposes (e.g. 'sortOrder' | 'title' |
 * 'publishedAt' on the blog page).
 */
export function SortHeader<T extends string>({
  label, col, active, dir, onClick,
}: {
  label: string;
  col: T;
  active: T;
  dir: 'asc' | 'desc';
  onClick: (col: T) => void;
}) {
  const isActive = active === col;
  const Icon = !isActive ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onClick(col)}
      className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors ${
        isActive ? 'text-purple-700' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
      <Icon className="h-3 w-3" />
    </button>
  );
}
