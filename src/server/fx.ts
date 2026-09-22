import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { fxRates } from './db/schema';
import { currencies, validDate } from './core';
import { convertMinor } from '../lib/currency';
const failures = new Map<string, number>();
const pending = new Map<string, Promise<typeof fxRates.$inferSelect | null>>();
export async function myrRate(currency: string, date: string | null) {
  if (
    currency === 'MYR' ||
    !currencies.includes(currency as (typeof currencies)[number]) ||
    !date ||
    !validDate(date) ||
    date > new Date().toISOString().slice(0, 10)
  )
    return null;
  const key = `${currency}:MYR:${date}`;
  const db = await getDb();
  const [cached] = await db.select().from(fxRates).where(eq(fxRates.key, key));
  if (cached) return cached;
  if (process.env.FX_PROVIDER === 'disabled' || (failures.get(key) || 0) > Date.now()) return null;
  if (pending.has(key)) return pending.get(key)!;
  const request = (async () => {
    try {
      const response = await fetch(
        `https://api.frankfurter.dev/v2/rate/${currency}/MYR?date=${date}&providers=ecb`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!response.ok) throw new Error('Rate unavailable');
      const row = await response.json();
      if (
        row.base !== currency ||
        row.quote !== 'MYR' ||
        !validDate(row.date) ||
        row.date > date ||
        !Number.isFinite(row.rate) ||
        row.rate <= 0
      )
        throw new Error('Invalid rate response');
      // Refuse stale responses instead of silently using an unrelated historical rate.
      if (Date.parse(date) - Date.parse(row.date) > 7 * 86400000) throw new Error('Stale rate');
      const rate = String(row.rate);
      convertMinor(100, rate);
      await db
        .insert(fxRates)
        .values({
          key,
          currency,
          requestedDate: date,
          rateDate: row.date,
          rate,
          source: 'Frankfurter / ECB',
        })
        .onConflictDoNothing();
      return (await db.select().from(fxRates).where(eq(fxRates.key, key)))[0];
    } catch {
      failures.set(key, Date.now() + 60000);
      return null;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, request);
  return request;
}
