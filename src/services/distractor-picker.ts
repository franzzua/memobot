// Embedding-based distractor selection for quizzes: candidates share the target's
// part of speech and are semantically close (so the choice is not trivial), but
// near-synonyms are dropped — a synonym would also fit the blank and make the
// question unanswerable.

type Candidate = { id: string; word?: string | null; type?: string | null; embedding?: unknown };

// The word list holds the same spelling more than once (e.g. VALIDATE with two
// descriptions), so uniqueness by id is not enough — options are compared by text.
export function normalizeWordText(word?: string | null): string {
    return (word ?? '').trim().toLowerCase();
}

// Above this cosine similarity two words are treated as synonyms and skipped.
// Calibrated on the current word set: interchangeable pairs (VACILLATE/WAVER 0.98,
// AMORPHOUS/NEBULOUS 0.91, COPIOUS/ABUNDANT 0.84, REFUTE/REBUT 0.73) sit above it,
// while related-but-distinct pairs (CONCEDE/ACKNOWLEDGE 0.70, ASSERT/VALIDATE 0.65)
// stay below and make good distractors.
export const SYNONYM_SIMILARITY = 0.72;
// Distractors are drawn at random from this many nearest remaining candidates.
export const SIMILAR_POOL_SIZE = 10;

export function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
}

function asVector(value: unknown): number[] | null {
    return Array.isArray(value) && value.length > 0 && typeof value[0] === 'number'
        ? value as number[]
        : null;
}

/**
 * Returns exactly `n` distractors, all spelled differently from each other and from
 * the target, or [] when the data cannot support the strategy (target lacks
 * POS/embedding, or fewer than `n` valid candidates remain) so the caller can fall
 * back to random selection.
 */
export function pickSimilarDistractors<T extends Candidate>(
    target: T,
    candidates: T[],
    n: number,
    random: () => number = Math.random,
): T[] {
    const targetVec = asVector(target.embedding);
    if (!targetVec || !target.type) return [];

    const targetText = normalizeWordText(target.word);
    const seenText = new Set<string>();
    const pool = candidates
        .filter(w => w.id !== target.id && w.type === target.type)
        .filter(w => normalizeWordText(w.word) !== targetText)
        .map(w => ({w, vec: asVector(w.embedding)}))
        .filter((x): x is { w: T; vec: number[] } => !!x.vec)
        .map(x => ({w: x.w, sim: cosineSimilarity(targetVec, x.vec)}))
        .filter(x => x.sim < SYNONYM_SIMILARITY)
        .sort((a, b) => b.sim - a.sim)
        // Keep the closest row of each spelling: duplicate entries would otherwise
        // show up as two identical options.
        .filter(x => {
            const text = normalizeWordText(x.w.word);
            if (!text) return true;
            if (seenText.has(text)) return false;
            seenText.add(text);
            return true;
        })
        .slice(0, SIMILAR_POOL_SIZE);
    if (pool.length < n) return [];

    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n).map(x => x.w);
}
