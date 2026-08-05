import {describe, test} from "node:test";
import {expect} from "expect";
import {Scheduler} from "../scheduler/scheduler";
import {SchedulerMockQueue} from "../scheduler/specs/mocks/SchedulerMockQueue";
import {TestJsonStorage, TestJsonSeed} from "../scheduler/storage/testJsonStorage";
import {SrsPlanner, buildQuizDates, introOffsetMs} from "./srs-planner";
import {Message} from "../types";
import {TimetablePolicyType} from "../scheduler/types";
import type {TimetableEntity} from "../scheduler/storage/schedulerStorage";
import type {MessageTimetable} from "../db/messagesDatabase";
import type {Word} from "../../prisma/client";

const day = 86400 * 1000;
const chatId = 'c1';

function word(i: number): Word {
    return {id: `w${i}`, word: `word${i}`, description: `desc${i}`, satFrequency: 100 - i} as unknown as Word;
}

// A quiz timetable that was scheduled at `date` and has already fired (next exhausted).
function firedQuiz(index: number, date: Date): TimetableEntity<MessageTimetable> {
    return {
        id: `quiz.${index}`, content: '', details: '', createdAt: date, number: 0,
        deleted: false, kind: 'quiz', refId: null,
        type: TimetablePolicyType.Dates, dates: [date],
        next: null, last: date, invokeCounter: 1,
    } as unknown as TimetableEntity<MessageTimetable>;
}

function make(seed: TestJsonSeed) {
    const store = new TestJsonStorage(seed);
    const scheduler = new Scheduler<Message>(store, new SchedulerMockQueue());
    const planner = new SrsPlanner(store, scheduler);
    return {store, scheduler, planner};
}

const fiveWords = [0, 1, 2, 3, 4].map(word);

describe("SrsPlanner (TestJsonStorage)", () => {
    test("no plan state → next time null and advance is a no-op", async () => {
        const {planner, store} = make({chats: [{id: chatId}]});
        expect(await planner.getNextMessageTime(chatId)).toBeNull();
        expect(await planner.advance(chatId)).toEqual({scheduledWord: null, scheduledQuiz: false});
        expect(await store.countMessagesByKind(chatId, 'word')).toBe(0);
    });

    test("fresh plan schedules word[0] + a tick and arms the queue", async () => {
        const {planner, store} = make({chats: [{id: chatId}], words: fiveWords});
        const res = await planner.planForChat(chatId, 'B2', 1);

        expect(res.wordCount).toBe(5);
        expect(await store.countMessagesByKind(chatId, 'word')).toBe(1);
        expect(await store.countMessagesByKind(chatId, 'tick')).toBe(1);
        expect(await planner.getNextMessageTime(chatId)).toBeInstanceOf(Date);
        expect(store.state.chats[chatId].scheduledAt).toBeInstanceOf(Date);
    });

    test("advance mid-plan introduces the next word in order", async () => {
        const {planner, store} = make({chats: [{id: chatId}], words: fiveWords});
        await planner.planForChat(chatId, 'B2', 1);

        const r = await planner.advance(chatId);
        expect(r.scheduledWord?.id).toBe('w1');
        expect(await store.countMessagesByKind(chatId, 'word')).toBe(2);
    });

    test("advance past the quiz-peak fires due quizzes and re-arms a future tick", async () => {
        const past = new Date(Date.now() - 9 * day);
        const {planner} = make({
            chats: [{id: chatId, planStart: past, planDurationDays: 10, wordOrder: []}],
        });

        const r = await planner.advance(chatId);
        expect(r.scheduledQuiz).toBe(true);

        const next = await planner.getNextMessageTime(chatId);
        expect(next).toBeInstanceOf(Date);
        expect(next!.getTime()).toBeGreaterThan(Date.now());
    });

    test("a slot elapsing exactly when its tick fires is delivered late, not skipped", async () => {
        const planDurationDays = 10;
        const offsets = buildQuizDates(new Date(0), planDurationDays * day, 0).map(d => +d);
        // Slots 0-2 were scheduled and fired; the tick armed at slot 3's date fired 1s ago.
        const planStart = new Date(Date.now() - offsets[3] - 1000);
        const {planner, store} = make({
            chats: [{id: chatId, planStart, planDurationDays, wordOrder: []}],
            messages: {[chatId]: [0, 1, 2].map(i => firedQuiz(i, new Date(+planStart + offsets[i])))},
        });

        const r = await planner.advance(chatId);
        expect(r.scheduledQuiz).toBe(true);

        const q3 = (await store.getMessagesByKind(chatId, ['quiz'])).find(m => m.id === 'quiz.3');
        expect(q3).toBeDefined();
        // Persisted with a future occurrence — Scheduler.schedule() would have dropped
        // the slot's own (elapsed) date, so it must have been clamped forward.
        expect(q3!.next).toBeInstanceOf(Date);
        expect(+q3!.dates[0]).toBeGreaterThan(+planStart + offsets[3]);
    });

    test("after downtime only the most recent elapsed slot is delivered, then the plan resumes", async () => {
        const planDurationDays = 10;
        const offsets = buildQuizDates(new Date(0), planDurationDays * day, 0).map(d => +d);
        // Slots 0-5 all elapsed with nothing scheduled (bot was down).
        const planStart = new Date(Date.now() - offsets[5] - 1000);
        const {planner, store} = make({
            chats: [{id: chatId, planStart, planDurationDays, wordOrder: []}],
        });

        expect((await planner.advance(chatId)).scheduledQuiz).toBe(true);
        const ids = (await store.getMessagesByKind(chatId, ['quiz'])).map(m => m.id);
        expect(ids).toEqual(['quiz.5']);

        // The next tick pre-schedules slot 6 at its own (future) date; 5 is not re-sent.
        expect((await planner.advance(chatId)).scheduledQuiz).toBe(true);
        const q6 = (await store.getMessagesByKind(chatId, ['quiz'])).find(m => m.id === 'quiz.6');
        expect(+q6!.dates[0]).toBe(+planStart + offsets[6]);
    });

    test("advance on a finished plan schedules nothing and leaves no next message", async () => {
        const past = new Date(Date.now() - 5 * day);
        const {planner} = make({
            chats: [{id: chatId, planStart: past, planDurationDays: 1, wordOrder: []}],
        });

        expect(await planner.advance(chatId)).toEqual({scheduledWord: null, scheduledQuiz: false});
        expect(await planner.getNextMessageTime(chatId)).toBeNull();
    });

    test("projectPlan marks the introduced word scheduled and the rest projected", async () => {
        const {planner} = make({chats: [{id: chatId}], words: fiveWords});
        await planner.planForChat(chatId, 'B2', 1);

        const proj = await planner.projectPlan(chatId);
        expect(proj.words.length).toBe(5);
        expect(proj.words[0].scheduled).toBe(true);
        expect(proj.words[4].scheduled).toBe(false);
    });
});

describe("SRS timing math", () => {
    test("buildQuizDates is empty for a plan too short to reach the peak", () => {
        expect(buildQuizDates(new Date(), 1 * day, 5)).toEqual([]);
    });

    test("buildQuizDates returns a strictly ascending schedule for a normal plan", () => {
        const q = buildQuizDates(new Date(), 30 * day, 200);
        expect(q.length).toBeGreaterThan(0);
        for (let i = 1; i < q.length; i++) {
            expect(+q[i]).toBeGreaterThan(+q[i - 1]);
        }
    });

    test("introOffsetMs is zero for the first introduction", () => {
        expect(introOffsetMs(5, 4 * 3600 * 1000, 0)).toBe(0);
    });
});
