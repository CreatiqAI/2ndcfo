import { categories } from '../core';
/** Provider-independent review policy. A high score never constitutes approval. */
export function categorisationDecision(input: {
  category: string | null;
  confidence: number;
  incomplete: boolean;
  duplicate: boolean;
}) {
  const category = categories.includes(input.category || '') ? input.category : null;
  return {
    category,
    reviewStatus:
      input.incomplete || !category || input.duplicate || input.confidence < 80
        ? ('Needs Review' as const)
        : ('Ready' as const),
  };
}
