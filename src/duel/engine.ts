// Word Duel: two players take tiles from a shared 8×12 letter board, one per turn, in any
// order. A word is a chain of 5+ tiles touching up/down/left/right, read in either
// direction. Taking the last tile of a chain you fully own banks the word automatically.
// Pure game logic: no I/O, so the server, the bot and the specs all share it.

export const COLS = 8;
export const ROWS = 12;
export const CELLS = COLS * ROWS;
export const TURNS = 24;
export const HIDDEN_COUNT = 7;
export const MIN_WORD = 5;

export type Player = 0 | 1;
export type Tile = { ch: string; owner: -1 | Player; banked: boolean };
export type Banked = { word: string; pts: number; study: boolean; cells: number[]; player: Player };
export type Move = { player: Player; cell: number; banked: Banked[] };
export type Hidden = { word: string; desc: string; cells: number[]; by: -1 | Player };
export type DuelState = {
    grid: Tile[];
    hidden: Hidden[];
    turn: Player;
    turnsLeft: [number, number];
    scores: [number, number];
    words: Banked[];
    moves: Move[];
    over: boolean;
};
export type StudyWord = { word: string; desc: string };
export type Rng = () => number;

export class Lexicon {
    readonly words = new Set<string>();
    readonly prefixes = new Set<string>();

    constructor(words: Iterable<string>) {
        for (const w of words) this.add(w.trim().toUpperCase());
    }

    add(w: string) {
        if (!w) return;
        this.words.add(w);
        for (let k = 1; k <= w.length; k++) this.prefixes.add(w.slice(0, k));
    }
}

export const NEIGH: number[][] = Array.from({length: CELLS}, (_, i) => {
    const r = Math.floor(i / COLS), c = i % COLS, list: number[] = [];
    if (r > 0) list.push(i - COLS);
    if (r < ROWS - 1) list.push(i + COLS);
    if (c > 0) list.push(i - 1);
    if (c < COLS - 1) list.push(i + 1);
    return list;
});

const BAG = "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPRRRRRRSSSSTTTTTTUUUUVVWWXYYZ";

function shuffle<T>(a: T[], rng: Rng): T[] {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function placeChain(letters: (string | null)[], word: string, rng: Rng): number[] | null {
    const starts = shuffle([...Array(CELLS).keys()].filter(i => !letters[i]), rng).slice(0, 40);
    const walk = (path: number[]): boolean => {
        if (path.length === word.length) return true;
        for (const n of shuffle(NEIGH[path[path.length - 1]].slice(), rng)) {
            if (letters[n] || path.includes(n)) continue;
            path.push(n);
            if (walk(path)) return true;
            path.pop();
        }
        return false;
    };
    for (const s of starts) {
        const path = [s];
        if (walk(path)) return path;
    }
    return null;
}

/**
 * A new board with HIDDEN_COUNT study words laid out as chains and random filler around
 * them. `study` is in order of preference: earlier words are placed first.
 */
export function newDuel(study: StudyWord[], rng: Rng = Math.random): DuelState {
    const pool = study.filter(s => /^[A-Z]{5,9}$/.test(s.word));
    for (let attempt = 0; attempt < 60; attempt++) {
        const letters: (string | null)[] = Array(CELLS).fill(null);
        const hidden: Hidden[] = [];
        for (const s of attempt ? shuffle(pool.slice(), rng) : pool) {
            if (hidden.length >= HIDDEN_COUNT) break;
            if (hidden.some(h => h.word === s.word)) continue;
            const cells = placeChain(letters, s.word, rng);
            if (!cells) continue;
            cells.forEach((c, k) => letters[c] = s.word[k]);
            hidden.push({word: s.word, desc: s.desc, cells, by: -1});
        }
        if (hidden.length < Math.min(HIDDEN_COUNT, pool.length)) continue;
        return {
            grid: letters.map(ch => ({ch: ch ?? BAG[Math.floor(rng() * BAG.length)], owner: -1, banked: false})),
            hidden,
            turn: 0,
            turnsLeft: [TURNS, TURNS],
            scores: [0, 0],
            words: [],
            moves: [],
            over: false,
        };
    }
    throw new Error("Word Duel: could not lay out the board");
}

const isStudy = (s: DuelState, w: string) => s.hidden.some(h => h.word === w);
const isNew = (s: DuelState, w: string) => !s.words.some(x => x.word === w);
const isWord = (s: DuelState, lex: Lexicon, w: string) => lex.words.has(w) || isStudy(s, w);
const isPrefix = (s: DuelState, lex: Lexicon, p: string) => lex.prefixes.has(p) || s.hidden.some(h => h.word.startsWith(p));
const holds = (s: DuelState, i: number, k: Player) => s.grid[i].owner === k && !s.grid[i].banked;

/** 1 point a letter, study words hidden on this board double, 9+ letters +5. */
export function wordValue(s: DuelState, w: string) {
    let v = w.length;
    if (isStudy(s, w)) v *= 2;
    if (w.length >= 9) v += 5;
    return v;
}

export type Chain = { cells: number[]; word: string; free: number };

/**
 * Chains spelling words not banked yet, over tiles that are free or held (unbanked) by
 * player k, with between minFree and maxFree free tiles in them.
 */
export function chains(s: DuelState, lex: Lexicon, k: Player, maxFree: number, minFree = 0, limit = 4000): Chain[] {
    const res: Chain[] = [];
    const ok = (i: number) => s.grid[i].owner < 0 || holds(s, i, k);
    const dfs = (seq: number[], word: string, free: number) => {
        if (res.length >= limit) return;
        if (word.length >= MIN_WORD && free >= minFree && isWord(s, lex, word) && isNew(s, word))
            res.push({cells: seq.slice(), word, free});
        for (const n of NEIGH[seq[seq.length - 1]]) {
            if (!ok(n) || seq.includes(n)) continue;
            const f2 = free + (s.grid[n].owner < 0 ? 1 : 0);
            if (f2 > maxFree) continue;
            const w2 = word + s.grid[n].ch;
            if (!isPrefix(s, lex, w2)) continue;
            seq.push(n);
            dfs(seq, w2, f2);
            seq.pop();
        }
    };
    for (let i = 0; i < CELLS; i++) {
        if (!ok(i) || !isPrefix(s, lex, s.grid[i].ch)) continue;
        const f = s.grid[i].owner < 0 ? 1 : 0;
        if (f <= maxFree) dfs([i], s.grid[i].ch, f);
    }
    return res;
}

export const freeCells = (s: DuelState) => s.grid.flatMap((g, i) => g.owner < 0 ? [i] : []);

/**
 * The player whose turn it is takes a free tile. Every word that tile completes is banked
 * (best first), then the turn passes. Mutates and returns the state.
 */
export function take(s: DuelState, lex: Lexicon, cell: number): DuelState {
    if (s.over) throw new DuelError("The game is over.");
    if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) throw new DuelError("No such tile.");
    if (s.grid[cell].owner >= 0) throw new DuelError("That tile is already taken.");
    const k = s.turn;
    s.grid[cell].owner = k;
    const move: Move = {player: k, cell, banked: []};
    for (; ;) {
        const best = chains(s, lex, k, 0).filter(c => c.cells.includes(cell))
            .sort((a, b) => wordValue(s, b.word) - wordValue(s, a.word))[0];
        if (!best) break;
        const pts = wordValue(s, best.word);
        const banked: Banked = {word: best.word, pts, study: isStudy(s, best.word), cells: best.cells, player: k};
        best.cells.forEach(i => s.grid[i].banked = true);
        s.words.push(banked);
        s.scores[k] += pts;
        for (const h of s.hidden) if (h.word === best.word && h.by < 0) h.by = k;
        move.banked.push(banked);
    }
    s.moves.push(move);
    s.turnsLeft[k]--;
    if (!freeCells(s).length || s.turnsLeft.every(t => t <= 0)) s.over = true;
    else if (s.turnsLeft[k ^ 1] > 0) s.turn = (k ^ 1) as Player;
    return s;
}

/**
 * The bot's choice of tile for player k. It goes for the words it can finish soonest and
 * blocks like a person would: only when the opponent holds an unbroken run of a word and
 * needs the tile at one of its ends, and not every time.
 */
export function botMove(s: DuelState, lex: Lexicon, k: Player, rng: Rng = Math.random): number {
    const opp = (k ^ 1) as Player;
    const threat = new Map<number, number>();
    for (const t of chains(s, lex, opp, 1, 1)) {
        const at = t.cells.findIndex(i => s.grid[i].owner < 0);
        if (at !== 0 && at !== t.cells.length - 1) continue;
        const cell = t.cells[at];
        threat.set(cell, Math.max(threat.get(cell) ?? 0, wordValue(s, t.word)));
    }
    const targets = chains(s, lex, k, 5, 1).map(t => {
        const need = t.cells.filter(i => s.grid[i].owner < 0);
        const blockBonus = need.reduce((m, i) => Math.max(m, threat.get(i) ?? 0), 0);
        return {...t, need, rate: wordValue(s, t.word) / t.free + blockBonus * 0.5};
    }).sort((a, b) => b.rate - a.rate);
    const target = targets[Math.floor(rng() * Math.min(3, targets.length))];
    const bestBlock = [...threat.entries()].sort((a, b) => b[1] - a[1])[0];
    if (bestBlock && (!target || bestBlock[1] > target.rate) && rng() < 0.7) return bestBlock[0];
    if (target) return target.need.slice().sort((a, b) => (threat.get(b) ?? 0) - (threat.get(a) ?? 0))[0];
    const free = freeCells(s);
    return free[Math.floor(rng() * free.length)];
}

/**
 * What a player may see: hidden study words stay secret (no word, no cells) until someone
 * banks them or the game ends.
 */
export function publicView(s: DuelState) {
    return {
        cols: COLS,
        rows: ROWS,
        grid: s.grid,
        turn: s.turn,
        turnsLeft: s.turnsLeft,
        scores: s.scores,
        words: s.words,
        moves: s.moves,
        over: s.over,
        hidden: s.hidden.map(h => s.over || h.by >= 0
            ? h
            : {word: null, desc: h.desc, cells: null, by: h.by, length: h.word.length}),
    };
}

export class DuelError extends Error {
}
