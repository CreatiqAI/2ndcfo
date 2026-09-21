import { normal } from '../core';
export type Obligation = {
  id: string;
  type: 'invoice' | 'claim';
  party: string;
  number: string;
  reference: string;
  description: string;
  date: string;
  currency: string;
  direction: 'in' | 'out';
  outstanding: number;
};
export type Movement = {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  currency: string;
  direction: string;
  remaining: number;
};
export type Suggestion = {
  bankId: string;
  targetId: string;
  targetType: 'invoice' | 'claim';
  amountMinor: number;
  confidence: number;
  signals: string[];
};
export function scoreMatch(
  target: Obligation,
  bank: Movement,
  historical = false,
): Suggestion | null {
  if (
    target.currency !== bank.currency ||
    target.direction !== bank.direction ||
    target.outstanding <= 0 ||
    bank.remaining <= 0
  )
    return null;
  let score = 0;
  const signals: string[] = [];
  const text = normal(`${bank.description} ${bank.reference || ''}`);
  if (bank.remaining === target.outstanding) {
    score += 25;
    signals.push('Exact amount');
  } else {
    score += 8;
    signals.push('Partial / split amount');
  }
  if (normal(target.party).length >= 3 && text.includes(normal(target.party))) {
    score += 25;
    signals.push('Party name');
  }
  if (normal(target.number).length >= 3 && text.includes(normal(target.number))) {
    score += 30;
    signals.push('Invoice number');
  }
  if (normal(target.reference).length >= 3 && text.includes(normal(target.reference))) {
    score += 25;
    signals.push('Bank reference');
  }
  const words = target.description
    .toLowerCase()
    .split(/\W+/)
    .filter((x) => x.length >= 5);
  if (words.some((x) => bank.description.toLowerCase().includes(x))) {
    score += 8;
    signals.push('Description');
  }
  const days = Math.abs(Date.parse(bank.date) - Date.parse(target.date)) / 86400000;
  if (days <= 7) {
    score += 10;
    signals.push('Date within 7 days');
  } else if (days <= 45) {
    score += 5;
    signals.push('Date within 45 days');
  }
  if (historical) {
    score += 8;
    signals.push('Confirmed payment history');
  }
  if (
    !signals.some((x) =>
      [
        'Party name',
        'Invoice number',
        'Bank reference',
        'Description',
        'Confirmed payment history',
      ].includes(x),
    )
  )
    return null;
  if (score < 30) return null;
  return {
    bankId: bank.id,
    targetId: target.id,
    targetType: target.type,
    amountMinor: Math.min(target.outstanding, bank.remaining),
    confidence: Math.min(score, 99),
    signals,
  };
}
export function suggestMatches(
  targets: Obligation[],
  banks: Movement[],
  history: Map<string, Set<string>> = new Map(),
) {
  return targets
    .flatMap((t) =>
      banks.flatMap((b) => {
        const historical = [...(history.get(t.party) || [])].some((x) =>
          normal(b.description).includes(x),
        );
        const s = scoreMatch(t, b, historical);
        return s ? [s] : [];
      }),
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 500);
}
export type SuggestionGroup = {
  id: string;
  label: string;
  items: Suggestion[];
  confidence: number;
};
// Bounded search avoids an exponential scan over an entire bank statement.
function subset<T>(rows: T[], value: (row: T) => number, total: number): T[] | null {
  const sorted = rows.filter((r) => value(r) < total).slice(0, 20);
  function walk(start: number, chosen: T[], sum: number): T[] | null {
    if (sum === total && chosen.length > 1) return chosen;
    if (chosen.length >= 4 || sum >= total) return null;
    for (let i = start; i < sorted.length; i++) {
      if (value(sorted[i]) > total - sum) continue;
      const found = walk(i + 1, [...chosen, sorted[i]], sum + value(sorted[i]));
      if (found) return found;
    }
    return null;
  }
  return walk(0, [], 0);
}
export function suggestGroups(targets: Obligation[], banks: Movement[]): SuggestionGroup[] {
  const groups: SuggestionGroup[] = [];
  for (const t of targets) {
    const candidates = banks.filter((b) => scoreMatch(t, b));
    const combined = subset(candidates, (b) => b.remaining, t.outstanding);
    if (combined) {
      const items = combined.map((b) => ({ ...scoreMatch(t, b)!, amountMinor: b.remaining }));
      groups.push({
        id: `combine:${t.id}`,
        label: `${combined.length} bank payments may settle ${t.party} ${t.number}`,
        items,
        confidence: Math.min(...items.map((i) => i.confidence)),
      });
    }
  }
  for (const b of banks) {
    const candidates = targets.filter((t) => scoreMatch(t, b));
    const split = subset(candidates, (t) => t.outstanding, b.remaining);
    if (split) {
      const items = split.map((t) => ({ ...scoreMatch(t, b)!, amountMinor: t.outstanding }));
      groups.push({
        id: `split:${b.id}`,
        label: `One bank payment may settle ${split.length} invoices / claims`,
        items,
        confidence: Math.min(...items.map((i) => i.confidence)),
      });
    }
  }
  return groups.slice(0, 20);
}
