import {describe, test} from "node:test";
import {expect} from "expect";
import {cosineSimilarity, pickSimilarDistractors, SIMILAR_POOL_SIZE, SYNONYM_SIMILARITY} from "./distractor-picker";

// 2D unit vectors let similarity be dialed in exactly: cos(angle to target [1, 0]).
function vec(angleRad: number): number[] {
    return [Math.cos(angleRad), Math.sin(angleRad)];
}

function word(id: string, type: string | null, embedding: unknown) {
    return {id, type, embedding};
}

const target = word('t', 'noun', vec(0));

describe("distractor-picker", () => {
    test("cosineSimilarity of identical, orthogonal and zero vectors", () => {
        expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
        expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
        expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
    });

    test("returns [] when target has no embedding or no POS", () => {
        const candidates = [word('a', 'noun', vec(1))];
        expect(pickSimilarDistractors(word('t', 'noun', null), candidates, 1)).toEqual([]);
        expect(pickSimilarDistractors(word('t', null, vec(0)), candidates, 1)).toEqual([]);
    });

    test("filters by POS and excludes the target itself", () => {
        const candidates = [
            target,
            word('verb1', 'verb', vec(1)),
            word('n1', 'noun', vec(1)),
            word('n2', 'noun', vec(1.1)),
        ];
        const picked = pickSimilarDistractors(target, candidates, 2, () => 0);
        expect(picked.map(w => w.id).sort()).toEqual(['n1', 'n2']);
    });

    test("skips near-synonyms above the similarity threshold", () => {
        const synonymAngle = Math.acos(SYNONYM_SIMILARITY + 0.01);
        const okAngle = Math.acos(SYNONYM_SIMILARITY - 0.01);
        const candidates = [
            word('syn', 'noun', vec(synonymAngle)),
            word('ok1', 'noun', vec(okAngle)),
            word('ok2', 'noun', vec(okAngle + 0.1)),
        ];
        const picked = pickSimilarDistractors(target, candidates, 2, () => 0);
        expect(picked.map(w => w.id).sort()).toEqual(['ok1', 'ok2']);
    });

    test("draws only from the closest SIMILAR_POOL_SIZE candidates", () => {
        // 20 candidates at increasing angular distance; the last 10 must never appear.
        const candidates = Array.from({length: 20}, (_, i) =>
            word(`w${i}`, 'noun', vec(Math.acos(SYNONYM_SIMILARITY) + 0.01 + i * 0.02)));
        for (let run = 0; run < 30; run++) {
            const picked = pickSimilarDistractors(target, candidates, 3);
            for (const w of picked) {
                expect(Number(w.id.slice(1))).toBeLessThan(SIMILAR_POOL_SIZE);
            }
        }
    });

    test("returns [] when fewer than n valid candidates exist", () => {
        const candidates = [word('only', 'noun', vec(1))];
        expect(pickSimilarDistractors(target, candidates, 3)).toEqual([]);
    });
});
