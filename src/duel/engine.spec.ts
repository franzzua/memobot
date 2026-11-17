import {describe, test} from "node:test";
import {expect} from "expect";
import {botMove, CELLS, chains, COLS, DuelState, HIDDEN_COUNT, Lexicon, NEIGH, newDuel, publicView, take, TURNS} from "./engine";

// Deterministic rng so boards and bot choices repeat.
function seeded(seed: number) {
    return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

const STUDY = ["BOLSTER", "REFUTE", "SKEPTIC", "CONCEDE", "VALIDATE", "ABRUPT", "ADAMANT", "INFER", "AFFINITY"]
    .map(word => ({word, desc: `meaning of ${word.toLowerCase()}`}));

// A board with every tile set by hand: row 0 spells LOSER, the rest is X.
function handBoard(rows: string[]): DuelState {
    const s = newDuel(STUDY, seeded(1));
    const letters = rows.join("").padEnd(CELLS, "X");
    s.grid = [...letters].map(ch => ({ch, owner: -1, banked: false}));
    s.hidden = [];
    return s;
}

const lex = new Lexicon(["loser", "lose", "roses", "sorel", "store"]);

describe("duel engine", () => {
    test("neighbours are up/down/left/right only, on an 8-wide board", () => {
        expect(NEIGH[0].sort((a, b) => a - b)).toEqual([1, COLS]);
        expect(NEIGH[COLS + 1].sort((a, b) => a - b)).toEqual([1, COLS, COLS + 2, 2 * COLS + 1]);
    });

    test("new board hides the study words as chains of touching tiles", () => {
        const s = newDuel(STUDY, seeded(7));
        expect(s.grid).toHaveLength(CELLS);
        expect(s.hidden).toHaveLength(HIDDEN_COUNT);
        for (const h of s.hidden) {
            expect(h.cells.map(c => s.grid[c].ch).join("")).toBe(h.word);
            for (let k = 1; k < h.cells.length; k++) expect(NEIGH[h.cells[k - 1]]).toContain(h.cells[k]);
        }
        expect(s.turnsLeft).toEqual([TURNS, TURNS]);
    });

    test("new board prefers study words in the order given", () => {
        const s = newDuel(STUDY, seeded(9));
        expect(s.hidden.map(h => h.word).sort()).toEqual(STUDY.slice(0, HIDDEN_COUNT).map(w => w.word).sort());
    });

    test("tiles taken in any order bank the word when the last one is taken", () => {
        const s = handBoard(["LOSERXXX"]);
        // player 0 takes R, O, E, L, S; player 1 takes far-away tiles in between
        const order = [4, 1, 3, 0, 2];
        const elsewhere = [90, 91, 92, 93];
        order.forEach((cell, k) => {
            take(s, lex, cell);
            if (k < order.length - 1) {
                expect(s.words).toHaveLength(0);
                take(s, lex, elsewhere[k]);
            }
        });
        expect(s.words.map(w => w.word)).toEqual(["LOSER"]);
        expect(s.scores).toEqual([5, 0]);
        expect([0, 1, 2, 3, 4].every(i => s.grid[i].banked && s.grid[i].owner === 0)).toBe(true);
        expect(s.moves.at(-1)!.banked[0].cells).toEqual([0, 1, 2, 3, 4]);
    });

    test("a word reads in either direction", () => {
        const s = handBoard(["RESOLXXX"]);
        for (const [cell, other] of [[0, 90], [1, 91], [2, 92], [3, 93]]) { take(s, lex, cell); take(s, lex, other); }
        take(s, lex, 4);
        expect(s.words.map(w => w.word)).toEqual(["LOSER"]);
    });

    test("an opponent's tile in the chain blocks the word", () => {
        const s = handBoard(["LOSERXXX"]);
        take(s, lex, 0); take(s, lex, 2); // player 1 takes the S
        for (const [cell, other] of [[1, 90], [3, 91]]) { take(s, lex, cell); take(s, lex, other); }
        take(s, lex, 4);
        expect(s.words).toHaveLength(0);
    });

    test("rejects taken tiles and ends after both players use their turns", () => {
        const s = newDuel(STUDY, seeded(3));
        take(s, lex, 0);
        expect(() => take(s, lex, 0)).toThrow("already taken");
        let n = 1;
        while (!s.over) take(s, lex, n++);
        expect(n).toBe(2 * TURNS);
        expect(() => take(s, lex, n)).toThrow("over");
    });

    test("study words score double", () => {
        const s = handBoard(["INFERXXX"]);
        s.hidden = [{word: "INFER", desc: "conclude", cells: [0, 1, 2, 3, 4], by: -1}];
        for (const [cell, other] of [[0, 90], [1, 91], [2, 92], [3, 93]]) { take(s, lex, cell); take(s, lex, other); }
        take(s, lex, 4);
        expect(s.words[0]).toMatchObject({word: "INFER", pts: 10, study: true});
        expect(s.hidden[0].by).toBe(0);
    });

    test("bot blocks an obvious word: an unbroken run missing its end tile", () => {
        const s = handBoard(["LOSERXXX"]);
        s.turn = 0;
        for (const [cell, other] of [[0, 90], [1, 91], [2, 92], [3, 93]]) { take(s, lex, cell); take(s, lex, other); }
        // player 0 holds L-O-S-E and needs R at cell 4; force the 70% block roll to pass
        const picks = new Set<number>();
        for (let seed = 0; seed < 20; seed++) picks.add(botMove(s, lex, 1, () => 0.1));
        expect([...picks]).toEqual([4]);
    });

    test("chains finds complete words a player holds", () => {
        const s = handBoard(["LOSERXXX"]);
        [0, 1, 2, 3, 4].forEach(i => s.grid[i].owner = 0);
        expect(chains(s, lex, 0, 0).map(c => c.word)).toContain("LOSER");
    });

    test("public view hides unbanked study words until the game ends", () => {
        const s = newDuel(STUDY, seeded(5));
        const view = publicView(s);
        expect(view.hidden.every(h => h.word === null && h.cells === null)).toBe(true);
        s.over = true;
        expect(publicView(s).hidden.every(h => typeof h.word === "string")).toBe(true);
    });

    test("bot vs bot plays a whole game without errors", () => {
        const big = new Lexicon(["loser", "roses", "store", "stone", "tones", "notes", "onset", "steno", "aster", "rates", "stare", "tears", "earns", "snare", "learn", "renal"]);
        const rng = seeded(11);
        const s = newDuel(STUDY, rng);
        while (!s.over) take(s, big, botMove(s, big, s.turn, rng));
        expect(s.moves).toHaveLength(2 * TURNS);
        expect(s.scores[0] + s.scores[1]).toBe(s.words.reduce((t, w) => t + w.pts, 0));
    });
});
