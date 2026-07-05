import {resolve, singleton} from "@cmmn/core";
import {DataStore} from "../scheduler/storage/dataStore";
import {Scheduler} from "../scheduler/scheduler";
import {TimetablePolicyType} from "../scheduler/types";
import {Message, MessageKind} from "../types";
import type {Word} from "../../prisma/client";
import {SchedulerStorage, ProjectedWord, ProjectedQuiz} from "./schedulerStorage";

export type {ProjectedWord, ProjectedQuiz} from "./schedulerStorage";

// db/scheduler are resolved via the abstract DataStore/Scheduler tokens (bound to
// PrismaStorage/TaskScheduler in start.ts). This keeps SrsPlanner — and its tests —
// free of any static import of the Prisma runtime, so it can run against TestJsonStorage
// with no database.

const day = 86400 * 1000;
const HOUR = 3600 * 1000;

// Linear-decay introduction schedule: rate(t) = (1/τ)·(1 − t/D), D = 2·N·τ.
// τ defaults to 4h at the start, but for short plans is shrunk so D fits within
// INTRO_WINDOW_FRACTION of plan duration.
const TARGET_START_INTERVAL_MS = 4 * HOUR;
const INTRO_WINDOW_FRACTION = 0.80;

// Index 0 is the intro; 1..5 map to WordSendHandlers[0..4] (quiz, voice, image, card, example).
const WORD_DELAYS = [0.0005, 0.01, 0.04, 0.08, 0.16, 0.32];

// Repetitions scale with how much time the learner has: short plans keep only the core
// recall loop (quiz, voice, image), 4-5 month plans add the flashcard, and longer plans
// also get a full example sentence. WordSendHandlers is ordered to match, so slicing
// WORD_DELAYS to a prefix is enough to select the active steps.
function repetitionCount(planDurationDays: number): number {
    const months = planDurationDays / 30;
    if (months < 4) return 3;
    if (months <= 5) return 4;
    return 5;
}

function wordDelaysForDuration(planDurationDays: number): number[] {
    return WORD_DELAYS.slice(0, 1 + repetitionCount(planDurationDays));
}

@singleton()
export class SrsPlanner implements SchedulerStorage {
    constructor(
        private db: DataStore = resolve(DataStore),
        private scheduler: Scheduler<Message> = resolve(Scheduler) as unknown as Scheduler<Message>,
    ) {}

    getNextMessageTime(chatId: string): Promise<Date | null> {
        return this.db.getNextTimetableTime(chatId);
    }

    async planForChat(chatId: string, level: string, months: number): Promise<{
        wordCount: number;
        quizCount: number;
        words: ProjectedWord[];
        quizzes: ProjectedQuiz[];
    }> {
        await this.wipeSrs(chatId);

        const T0 = new Date();
        const planDurationDays = months * 30;
        const T_ms = planDurationDays * day;
        const N = Math.max(200, Math.min(300, Math.round(planDurationDays * 2.5)));

        const picked = await this.db.pickTopForLevel(level, N);
        const wordOrder = picked.map(p => p.id);
        const wordCount = wordOrder.length;
        await this.db.savePlanState(chatId, T0, planDurationDays, wordOrder);

        const wordDelays = wordDelaysForDuration(planDurationDays);

        // Schedule word[0] directly so we can reuse `picked` and skip a DB round-trip.
        if (wordCount > 0) {
            await this.scheduleWord(chatId, picked[0], T0, T_ms, wordDelays);
        }
        const allQuizDates = buildQuizDates(T0, T_ms, wordCount);
        const nextTick = nextEventTime(T0, planDurationDays, wordCount, Math.min(1, wordCount), 0, allQuizDates);
        if (nextTick) {
            await this.armTick(chatId, +nextTick > +T0 ? nextTick : new Date(+T0 + 1000));
        }

        const tickStart = tickStartIntervalMs(planDurationDays, wordCount);
        const words: ProjectedWord[] = picked.map((w, i) => {
            const pickDate = i === 0 ? T0 : new Date(+T0 + introOffsetMs(wordCount, tickStart, i));
            return {
                word: w.word,
                description: w.description ?? '',
                dates: wordDelays.map(f => new Date(+pickDate + f * T_ms)),
                scheduled: i === 0,
            };
        });
        const quizzes: ProjectedQuiz[] = allQuizDates.map(d => ({date: d, scheduled: false}));

        return { wordCount, quizCount: allQuizDates.length, words, quizzes };
    }

    /**
     * Advance the plan: introduce the next word, fire any quizzes whose planned dates have
     * arrived, and re-arm the next tick at the next pending event (intro or quiz).
     */
    async advance(chatId: string): Promise<{ scheduledWord: Word | null; scheduledQuiz: boolean }> {
        const state = await this.db.getPlanState(chatId);
        if (!state) return { scheduledWord: null, scheduledQuiz: false };
        const { planStart: T0, planDurationDays, wordOrder } = state;
        const T_ms = planDurationDays * day;
        const wordCount = wordOrder.length;
        const now = new Date();

        await this.db.deactivateTicks(chatId);

        const wordDelays = wordDelaysForDuration(planDurationDays);

        let scheduledWord: Word | null = null;
        let wordCursor = await this.db.countMessagesByKind(chatId, 'word');
        if (wordCursor < wordCount) {
            const map = await this.db.getByIds([wordOrder[wordCursor]]);
            const word = map.get(wordOrder[wordCursor]);
            if (word) {
                await this.scheduleWord(chatId, word, now, T_ms, wordDelays);
                wordCursor++;
                scheduledWord = word;
            }
        }

        let scheduledQuiz = false;
        const allQuizDates = buildQuizDates(T0, T_ms, wordCount);
        let quizCursor = await this.db.countMessagesByKind(chatId, 'quiz');
        while (quizCursor < allQuizDates.length && +allQuizDates[quizCursor] <= +now) {
            await this.scheduleQuiz(chatId, quizCursor, allQuizDates[quizCursor]);
            quizCursor++;
            scheduledQuiz = true;
        }

        const nextTick = nextEventTime(T0, planDurationDays, wordCount, wordCursor, quizCursor, allQuizDates);
        if (nextTick) {
            await this.armTick(chatId, +nextTick > +now ? nextTick : new Date(+now + 1000));
        }

        return { scheduledWord, scheduledQuiz };
    }

    /**
     * Project the full plan: every word and quiz the user will eventually receive,
     * with actual dates for already-scheduled items and projected dates for future ones.
     */
    async projectPlan(chatId: string): Promise<{ words: ProjectedWord[]; quizzes: ProjectedQuiz[] }> {
        const state = await this.db.getPlanState(chatId);
        if (!state) return { words: [], quizzes: [] };
        const { planStart: T0, planDurationDays, wordOrder } = state;
        const T_ms = planDurationDays * day;
        const wordCount = wordOrder.length;
        const tickStart = tickStartIntervalMs(planDurationDays, wordCount);
        const wordDelays = wordDelaysForDuration(planDurationDays);

        const messages = await this.db.getMessagesByKind(chatId, ['word', 'quiz']);
        const scheduledWords = new Map<string, { content: string; details: string; dates: Date[] }>();
        const scheduledQuizDates: Date[] = [];
        for (const m of messages) {
            if (m.kind === 'word' && m.refId) {
                scheduledWords.set(m.refId, {
                    content: m.content,
                    details: m.details,
                    dates: [...m.dates].sort((a, b) => +a - +b),
                });
            } else if (m.kind === 'quiz') {
                for (const d of m.dates) scheduledQuizDates.push(d);
            }
        }

        const futureIds = wordOrder.filter(id => !scheduledWords.has(id));
        const futureWords = await this.db.getByIds(futureIds);

        const words: ProjectedWord[] = [];
        for (let i = 0; i < wordCount; i++) {
            const id = wordOrder[i];
            const scheduled = scheduledWords.get(id);
            if (scheduled) {
                words.push({
                    word: scheduled.content,
                    description: scheduled.details,
                    dates: scheduled.dates,
                    scheduled: true,
                });
                continue;
            }
            const w = futureWords.get(id);
            if (!w) continue;
            const pickDate = new Date(+T0 + introOffsetMs(wordCount, tickStart, i));
            const dates = wordDelays.map(f => new Date(+pickDate + f * T_ms));
            words.push({
                word: w.word,
                description: w.description ?? '',
                dates,
                scheduled: false,
            });
        }

        const allQuizDates = buildQuizDates(T0, T_ms, wordCount);
        scheduledQuizDates.sort((a, b) => +a - +b);
        const quizzes: ProjectedQuiz[] = allQuizDates.map((d, i) => {
            if (i < scheduledQuizDates.length) {
                return { date: scheduledQuizDates[i], scheduled: true };
            }
            return { date: d, scheduled: false };
        });

        return { words, quizzes };
    }

    private async wipeSrs(chatId: string): Promise<void> {
        await this.db.removeTimetablesByKind(chatId, ['word', 'quiz', 'tick']);
        await this.scheduler.recomputeTask(chatId);
    }

    private async scheduleWord(chatId: string, word: Word, t_i: Date, T_ms: number, wordDelays: number[]): Promise<void> {
        const dates = wordDelays.map(f => new Date(+t_i + f * T_ms));
        await this.scheduler.schedule(chatId, {
            id: `word.${word.id}`,
            content: word.word,
            details: word.description ?? '',
            createdAt: new Date(),
            number: 0,
            deleted: false,
            kind: 'word' as MessageKind,
            refId: word.id,
            type: TimetablePolicyType.Dates,
            dates,
        });
    }

    private async scheduleQuiz(chatId: string, index: number, when: Date): Promise<void> {
        await this.scheduler.schedule(chatId, {
            id: `quiz.${index}`,
            content: '',
            details: '',
            createdAt: new Date(),
            number: 0,
            deleted: false,
            kind: 'quiz' as MessageKind,
            refId: null,
            type: TimetablePolicyType.Dates,
            dates: [when],
        });
    }

    private async armTick(chatId: string, when: Date): Promise<void> {
        await this.scheduler.schedule(chatId, {
            id: `tick.${+when}`,
            content: '',
            details: '',
            createdAt: new Date(),
            number: 0,
            deleted: false,
            kind: 'tick' as MessageKind,
            refId: null,
            type: TimetablePolicyType.Dates,
            dates: [when],
        });
    }
}

// Starting interval τ for word introductions. With linear decay rate 1/τ → 0 over D = 2Nτ,
// we shrink τ on short plans so the intro window fits within INTRO_WINDOW_FRACTION of T.
export function tickStartIntervalMs(planDurationDays: number, wordCount: number): number {
    if (wordCount <= 0) return TARGET_START_INTERVAL_MS;
    const fitTau = INTRO_WINDOW_FRACTION * planDurationDays * day / (2 * wordCount);
    return Math.min(TARGET_START_INTERVAL_MS, fitTau);
}

// Time offset (ms from T0) of the i-th introduction under linear-decay rate.
// Derived from C(t) = r₀·t − r₀·t²/(2D) = i ⇒ t = D − √(D² − 2Di/r₀), with τ = 1/r₀.
export function introOffsetMs(wordCount: number, tickStartMs: number, i: number): number {
    if (i <= 0) return 0;
    if (i >= wordCount) return 2 * tickStartMs * wordCount;
    return 2 * tickStartMs * (wordCount - Math.sqrt(wordCount * (wordCount - i)));
}

// Quizzes start 5 days after the message-rate peak (the instant when the longest active
// per-word delay first kicks in for the first cohort, after which total rate decreases
// monotonically). Rate ramps 1/day → 10/day at 80% T, then 10/day → 4/day through 100% T.
const QUIZ_DELAY_AFTER_PEAK_MS = 5 * day;
export function buildQuizDates(T0: Date, T_ms: number, _wordCount: number): Date[] {
    const wordDelays = wordDelaysForDuration(T_ms / day);
    const quizStart = Math.max(...wordDelays) * T_ms + QUIZ_DELAY_AFTER_PEAK_MS;
    const peak = 0.80 * T_ms;
    if (quizStart >= T_ms) return [];
    const out: Date[] = [];
    let t = quizStart;
    while (t < T_ms) {
        out.push(new Date(+T0 + t));
        let perDay: number;
        if (t < peak) {
            const span = peak - quizStart;
            const i = span > 0 ? (t - quizStart) / span : 1;
            perDay = 1 + 9 * i;
        } else {
            const i = (t - peak) / (T_ms - peak);
            perDay = 10 - 6 * i;
        }
        t += day / perDay;
    }
    return out;
}

function nextEventTime(
    T0: Date,
    planDurationDays: number,
    wordCount: number,
    wordCursor: number,
    quizCursor: number,
    allQuizDates: Date[],
): Date | null {
    const tickStart = tickStartIntervalMs(planDurationDays, wordCount);
    let next = Infinity;
    if (wordCursor < wordCount) {
        next = Math.min(next, +T0 + introOffsetMs(wordCount, tickStart, wordCursor));
    }
    if (quizCursor < allQuizDates.length) {
        next = Math.min(next, +allQuizDates[quizCursor]);
    }
    return next === Infinity ? null : new Date(next);
}
