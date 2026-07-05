import {describe, test} from "node:test";
import {expect} from "expect";
import {writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Scheduler} from "../scheduler/scheduler";
import {SchedulerMockQueue} from "../scheduler/specs/mocks/SchedulerMockQueue";
import {TestJsonStorage} from "../scheduler/storage/testJsonStorage";
import {SrsPlanner, buildQuizDates} from "./srs-planner";
import {Message} from "../types";
import type {Word} from "../../prisma/client";

const day = 86400 * 1000;
const chatId = 'sim';

// The per-word sends, in the order the scheduler fires them (see telegraf.api sendTasks +
// WordSendHandlers): index 0 is the word card, 1..5 map to WordSendHandlers[0..4]. A 4-month
// plan gets 4 reps (quiz, voice, picture, card) — no example, which only kicks in past 5 months.
const WORD_TYPE_BY_INDEX = ['description', 'quiz', 'voice', 'picture', 'card', 'example'];

function word(i: number): Word {
    return {id: `w${i}`, word: `word${i}`, description: `meaning of word ${i}`, satFrequency: 100000 - i} as unknown as Word;
}

function classify(kind: string, dateIndex: number): string {
    if (kind === 'word') return WORD_TYPE_BY_INDEX[dateIndex] ?? `word+${dateIndex}`;
    if (kind === 'quiz') return 'satQuiz';
    return kind;
}

type Row = {date: Date; type: string; word: string};

describe("SRS 4-month plan → CSV", () => {
    test("drive the scheduler through a 4-month plan and dump every message to CSV", async () => {
        const store = new TestJsonStorage({
            chats: [{id: chatId}],
            words: Array.from({length: 320}, (_, i) => word(i)),
        });
        const scheduler = new Scheduler<Message>(store, new SchedulerMockQueue());
        const planner = new SrsPlanner(store, scheduler);

        // The scheduler reads `new Date()` directly, so run the whole 4-month simulation
        // against a controllable clock instead of wall time.
        const RealDate = globalThis.Date;
        const T0 = +new RealDate('2026-01-01T00:00:00Z');
        let CURRENT = T0;
        class FakeDate extends RealDate {
            constructor(...args: any[]) {
                if (args.length === 0) super(CURRENT); else super(...(args as [any]));
            }
            static now() { return CURRENT; }
        }

        const rows: Row[] = [];
        globalThis.Date = FakeDate as unknown as DateConstructor;
        try {
            await planner.planForChat(chatId, 'B2', 4);

            let quizzesRecorded = 0;
            let guard = 0;
            while (guard++ < 500_000) {
                const next = await planner.getNextMessageTime(chatId);
                if (!next) break;
                CURRENT = +next;

                const state = await scheduler.getTaskState(chatId, next);
                let tickFired = false;
                for (const {data: message, dates} of state.unprocessed) {
                    if (message.kind === 'tick') { tickFired = true; continue; }
                    for (let i = 0; i < dates.length; i++) {
                        rows.push({
                            date: dates[i],
                            type: classify(message.kind as string, message.invokeCounter + i),
                            word: message.content,
                        });
                    }
                }
                await state.markProcessed();

                if (tickFired) {
                    // advance() schedules the due quizzes at their exact plan dates, which the
                    // scheduler drops as same-instant timetables — capture them here for the report.
                    const plan = await store.getPlanState(chatId);
                    if (plan) {
                        const quizDates = buildQuizDates(plan.planStart, plan.planDurationDays * day, plan.wordOrder.length);
                        while (quizzesRecorded < quizDates.length && +quizDates[quizzesRecorded] <= CURRENT) {
                            rows.push({date: quizDates[quizzesRecorded], type: 'satQuiz', word: ''});
                            quizzesRecorded++;
                        }
                    }
                    await planner.advance(chatId);
                }
            }
        } finally {
            globalThis.Date = RealDate;
        }

        rows.sort((a, b) => +a.date - +b.date);

        const header = 'index,datetime,day,type,word';
        const body = rows.map((r, i) =>
            [i, r.date.toISOString(), ((+r.date - T0) / day).toFixed(3), r.type, r.word].join(',')
        );
        const csv = [header, ...body].join('\n') + '\n';

        const out = process.env.SRS_CSV_OUT ?? join(tmpdir(), 'srs-plan-4months.csv');
        writeFileSync(out, csv);
        const counts = rows.reduce<Record<string, number>>((m, r) => (m[r.type] = (m[r.type] ?? 0) + 1, m), {});
        console.log(`SRS 4-month plan: ${rows.length} messages → ${out}`);
        console.log('by type:', JSON.stringify(counts));

        // Sanity: the plan produced a real, multi-thousand-message timeline covering every type
        // a 4-month plan (4 reps: quiz, voice, picture, card) actually sends.
        expect(rows.length).toBeGreaterThan(1000);
        for (const type of ['description', 'quiz', 'voice', 'picture', 'card', 'satQuiz']) {
            expect(counts[type]).toBeGreaterThan(0);
        }
        // Example is only added for plans longer than 5 months, so a 4-month plan sends none.
        expect(counts['example']).toBeUndefined();
    });
});
