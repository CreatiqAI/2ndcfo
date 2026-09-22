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
