import {inject, singleton} from "@cmmn/core";
import {WordsDatabase} from "../db/wordsDatabase";
import {PrismaSchedulerStorage} from "../db/prismaSchedulerStorage";
import {TaskScheduler} from "../db/task.scheduler";
import {Scheduler} from "../scheduler/scheduler";
import {TimetablePolicyType} from "../scheduler/types";
import {Message, MessageKind} from "../types";
import type {Word} from "../../prisma/client";

const day = 86400 * 1000;

const WORD_DELAYS = [0.0005, 0.01, 0.02, 0.04, 0.08, 0.16, 0.24, 0.48];

@singleton()
export class SrsPlanner {
    @inject(WordsDatabase)
    private accessor words!: WordsDatabase;
    @inject(PrismaSchedulerStorage)
    private accessor db!: PrismaSchedulerStorage;
    @inject(TaskScheduler)
    private accessor scheduler!: Scheduler<Message>;

    async planForChat(chatId: string, level: string, months: number): Promise<{ wordCount: number; quizCount: number }> {
        await this.wipeSrs(chatId);

        const T0 = new Date();
        const T_ms = months * 30 * day;
        const N = Math.floor((months * 30) / 4);

        const picked = await this.words.pickTopForLevel(level, N);
        for (let i = 0; i < picked.length; i++) {
            const t_i = new Date(+T0 + (i / Math.max(picked.length, 1)) * 0.25 * T_ms);
            await this.scheduleWord(chatId, picked[i], t_i, T_ms);
        }
        const quizDates = buildQuizDates(T0, T_ms);
        await this.scheduleQuizzes(chatId, quizDates);
        return { wordCount: picked.length, quizCount: quizDates.length };
    }

    private async wipeSrs(chatId: string): Promise<void> {
        await this.db.removeTimetablesByKind(chatId, ['word', 'quiz']);
        await this.scheduler.recomputeTask(chatId);
    }

    private async scheduleWord(chatId: string, word: Word, t_i: Date, T_ms: number): Promise<void> {
        const dates = WORD_DELAYS.map(f => new Date(+t_i + f * T_ms));
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

    private async scheduleQuizzes(chatId: string, dates: Date[]): Promise<void> {
        if (dates.length === 0) return;
        await this.scheduler.schedule(chatId, {
            id: 'quiz',
            content: '',
            details: '',
            createdAt: new Date(),
            number: 0,
            deleted: false,
            kind: 'quiz' as MessageKind,
            refId: null,
            type: TimetablePolicyType.Dates,
            dates,
        });
    }
}

// Linear ramp-up: 7d at 25% T → 1d at 75% T → 1d through 100% T.
export function buildQuizDates(T0: Date, T_ms: number): Date[] {
    const out: Date[] = [];
    let t = 0.25 * T_ms;
    while (t < T_ms) {
        out.push(new Date(+T0 + t));
        let intervalDays: number;
        if (t < 0.75 * T_ms) {
            const i = (t - 0.25 * T_ms) / (0.5 * T_ms);
            intervalDays = 7 - 6 * i;
        } else {
            intervalDays = 1;
        }
        t += intervalDays * day;
    }
    return out;
}
