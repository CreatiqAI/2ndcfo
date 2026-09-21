import { normal } from '../core';
import { similarImage } from '../ingestion/storage';
type Candidate = {
  number: string | null;
  party: string | null;
  date: string | null;
  totalMinor: number | null;
  description: string | null;
  sourceHash: string;
  imageHash: string | null;
  pageStart: number;
};
type Prior = Candidate & { id: string };
function contentSimilarity(a: string | null, b: string | null) {
  const words = (text: string | null) =>
    new Set(
      (text || '')
        .toLowerCase()
        .split(/\W+/)
        .filter((x) => x.length > 2),
    );
  const left = words(a),
    right = words(b);
  if (left.size < 5 || right.size < 5) return 0;
  const union = new Set([...left, ...right]);
  return [...left].filter((x) => right.has(x)).length / union.size;
}
export function detectDuplicate(
  candidate: Candidate,
  previous: Prior[],
): { id: string; reason: string } | null {
  for (const prior of previous) {
    if (prior.sourceHash === candidate.sourceHash && prior.pageStart === candidate.pageStart)
      return { id: prior.id, reason: 'Identical document hash and source page' };
    const sameParty = !!normal(candidate.party) && normal(prior.party) === normal(candidate.party);
    const sameAmount = candidate.totalMinor !== null && prior.totalMinor === candidate.totalMinor;
    if (
      sameParty &&
      sameAmount &&
      normal(candidate.number) &&
      normal(prior.number) === normal(candidate.number)
    )
      return { id: prior.id, reason: 'Matching invoice / receipt number, merchant and amount' };
    const sameDate = !!candidate.date && candidate.date === prior.date;
    if (sameParty && sameAmount && sameDate && similarImage(candidate.imageHash, prior.imageHash))
      return {
        id: prior.id,
        reason: 'Similar receipt image with matching merchant, date and amount',
      };
    if (
      sameParty &&
      sameAmount &&
      sameDate &&
      contentSimilarity(candidate.description, prior.description) >= 0.8
    )
      return {
        id: prior.id,
        reason: 'Similar extracted content with matching party, date and amount',
      };
    if (sameParty && sameAmount && sameDate && !normal(candidate.number))
      return {
        id: prior.id,
        reason:
          'Matching merchant, date and amount without a unique receipt number; review required',
      };
  }
  return null;
}
