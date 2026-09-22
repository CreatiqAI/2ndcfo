'use client';

import { useState, type ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { documentMonth, monthLabel, groupByDocumentMonth } from '@/lib/document-months';

export function DocumentCalendar<T extends { invoiceDate: string | null }>({
  invoices,
  renderTable,
}: {
  invoices: T[];
  renderTable: (rows: T[]) => ReactNode;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [selection, setSelection] = useState('all');
  const groups = groupByDocumentMonth(invoices);
  const visible = groups.filter(([key]) => selection === 'all' || key === selection);
  const years = [
    ...new Set([
      year,
      new Date().getFullYear(),
      ...invoices.flatMap((i) => {
        const month = documentMonth(i.invoiceDate);
        return month ? [Number(month.slice(0, 4))] : [];
      }),
    ]),
  ].sort((a, b) => b - a);
  const changeYear = (next: number) => {
    setYear(next);
    if (/^\d{4}-\d{2}$/.test(selection)) setSelection(`${next}-${selection.slice(5)}`);
  };
  return (
    <div className="document-calendar">
      <div className="document-calendar-header">
        <div>
          <h3>
            <CalendarDays size={19} /> Invoices by month
          </h3>
          <p>
            Automatically organised by the invoice date read by AI, not the upload date. Correcting
            a date moves the invoice to its new month.
          </p>
        </div>
        <div className="document-calendar-year">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous year"
            disabled={year <= 1000}
            onClick={() => changeYear(year - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <select
            aria-label="Document calendar year"
            value={year}
            onChange={(e) => changeYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-button"
            aria-label="Next year"
            disabled={year >= 9999}
            onClick={() => changeYear(year + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="document-month-grid" aria-label={`Invoice months for ${year}`}>
        {Array.from({ length: 12 }, (_, index) => {
          const key = `${year}-${String(index + 1).padStart(2, '0')}`;
          const count = groups.find(([month]) => month === key)?.[1].length || 0;
          return (
            <button
              type="button"
              key={key}
              aria-pressed={selection === key}
              aria-label={`${monthLabel(key)}, ${count} invoices`}
              onClick={() => setSelection(key)}
            >
              <span>{monthLabel(key).split(' ')[0]}</span>
              <strong>{count}</strong>
              <small>{count === 1 ? 'invoice' : 'invoices'}</small>
            </button>
          );
        })}
      </div>
      <div className="document-month-options">
        <button
          type="button"
          className="button secondary"
          aria-pressed={selection === 'all'}
          onClick={() => setSelection('all')}
        >
          All months · {invoices.length}
        </button>
        <button
          type="button"
          className="button secondary"
          aria-pressed={selection === 'undated'}
          onClick={() => setSelection('undated')}
        >
          Date needed · {groups.find(([key]) => key === 'undated')?.[1].length || 0}
        </button>
        <small>
          Counts follow your search and status filters. Unprocessed files appear in Originals.
        </small>
      </div>
      <div aria-live="polite">
        {visible.length ? (
          visible.map(([key, rows]) => (
            <section className="document-month-section" key={key} aria-label={monthLabel(key)}>
              <div className="document-month-section-heading">
                <h3>{monthLabel(key)}</h3>
                <span>
                  {rows.length} invoice{rows.length === 1 ? '' : 's'}
                </span>
              </div>
              {key === 'undated' && (
                <p className="document-month-help">
                  Review these documents and confirm their invoice dates to place them in the right
                  month.
                </p>
              )}
              {renderTable(rows)}
            </section>
          ))
        ) : (
          <div className="empty">
            <CalendarDays size={30} />
            <h3>
              {selection === 'all'
                ? 'No matching invoices'
                : `No invoices in ${monthLabel(selection)}`}
            </h3>
            <p>Try another month or status filter. New uploads appear here after extraction.</p>
          </div>
        )}
      </div>
    </div>
  );
}
