export function invoiceCurrency(detected: string | null, selected = 'MYR') {
  return selected !== 'MYR' ? selected : detected?.trim().toUpperCase() || 'MYR';
}
export function convertMinor(amount: number, rate: string): number {
  if (!Number.isSafeInteger(amount) || amount < 0 || !/^\d+(\.\d{1,12})?$/.test(rate))
    throw new Error('Invalid conversion amount or rate.');
  const [whole, fraction = ''] = rate.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole + fraction);
  if (numerator <= 0n) throw new Error('Rate must be positive.');
  const result = (BigInt(amount) * numerator + scale / 2n) / scale;
  if (result > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Converted amount exceeds safe precision.');
  return Number(result);
}
// Cross rates share MYR as a base; round only once at the final currency's cents.
export function convertMinorCross(
  amount: number,
  sourceToMyr: string,
  targetToMyr: string,
): number {
  const fraction = (rate: string) => {
    if (!/^\d+(\.\d{1,12})?$/.test(rate)) throw new Error('Invalid exchange rate.');
    const [whole, part = ''] = rate.split('.');
    const n = BigInt(whole + part);
    if (n <= 0n) throw new Error('Invalid exchange rate.');
    return [n, 10n ** BigInt(part.length)];
  };
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid amount.');
  const [sn, sd] = fraction(sourceToMyr),
    [tn, td] = fraction(targetToMyr);
  const denominator = sd * tn,
    numerator = BigInt(amount) * sn * td;
  const result = (numerator + denominator / 2n) / denominator;
  if (result > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Converted amount exceeds safe precision.');
  return Number(result);
}
