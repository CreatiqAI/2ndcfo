'use client';
import { useState } from 'react';
import { monthLabel } from '@/lib/document-months';

export function MoneyCalendar({
  dates,
  selection,
  onSelect,
}: {
  dates: (string | null)[];
  selection: string;
  onSelect: (month: string) => void;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const years = [
    ...new Set([
      year,
      new Date().getFullYear(),
      ...dates.filter(Boolean).map((d) => Number(d!.slice(0, 4))),
    ]),
  ].sort((a, b) => b - a);
  return (
    <section className="panel document-calendar" style={{ marginBottom: 24 }}>
      <div className="document-calendar-header">
        <div>
          <h3>Records by month</h3>
          <p>
            Select a month to view invoices and monthly totals. Uses invoice dates; claims use their
            claim month.
          </p>
        </div>
        <div className="document-calendar-year">
          <button
            className="button secondary"
            disabled={year <= 1000}
            onClick={() => setYear(year - 1)}
            aria-label="Previous year"
          >
            ←
          </button>
          <select
            aria-label="Records calendar year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <button
            className="button secondary"
            disabled={year >= 9999}
            onClick={() => setYear(year + 1)}
            aria-label="Next year"
          >
            →
          </button>
        </div>
      </div>
      <div className="document-month-grid">
        {Array.from({ length: 12 }, (_, i) => {
          const month = `${year}-${String(i + 1).padStart(2, '0')}`,
            count = dates.filter((d) => d?.slice(0, 7) === month).length;
          return (
            <button key={month} aria-pressed={selection === month} onClick={() => onSelect(month)}>
              <span>{monthLabel(month).split(' ')[0]}</span>
              <strong>{count}</strong>
              <small>records</small>
            </button>
          );
        })}
      </div>
      <p aria-live="polite">
        {selection ? `Showing ${monthLabel(selection)}` : 'Choose a month to show records.'}
        {dates.some((d) => !d) ? ' Undated invoices can be reviewed in Documents.' : ''}
      </p>
    </section>
  );
}
