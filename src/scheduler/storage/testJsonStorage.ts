import {Task, TimetableEntity} from "./schedulerStorage";
import {DataStore} from "./dataStore";
import type {MessageTimetable} from "../../db/messagesDatabase";
import type {Word} from "../../../prisma/client";

export type TestChatRow = {
    id: string;
    scheduleId: string | null;
    scheduledAt: Date | null;
    planStart: Date | null;
    planDurationDays: number | null;
    wordOrder: string[];
    seenQuizIds: string[];
};

export type TestJsonState = {
    chats: Record<string, TestChatRow>;
    messages: Record<string, TimetableEntity<MessageTimetable>[]>;
    words: Word[];
};

export type TestJsonSeed = {
    chats?: Array<Partial<TestChatRow> & { id: string }>;
    messages?: Record<string, TimetableEntity<MessageTimetable>[]>;
    words?: Word[];
};

/**
 * In-memory {@link DataStore} backed by a plain JSON-serializable object. Substitutes
 * `PrismaStorage` in unit tests so the SRS scheduler can be exercised across conditions
 * (fresh plan, mid-plan, post-peak, exhausted, …) with no database. The raw `state` is
 * public so tests can seed and assert on it directly.
 */
export class TestJsonStorage extends DataStore {
    readonly state: TestJsonState;

    constructor(seed: TestJsonSeed = {}) {
        super();
        this.state = { chats: {}, messages: {}, words: seed.words ?? [] };
        for (const c of seed.chats ?? []) {
            this.state.chats[c.id] = this.blankChat(c.id, c);
            this.state.messages[c.id] ??= [];
        }
        for (const [chatId, rows] of Object.entries(seed.messages ?? {})) {
            this.state.messages[chatId] = rows.map(r => ({ ...r, dates: [...r.dates] }));
            this.ensureChat(chatId);
        }
    }

    private blankChat(id: string, over: Partial<TestChatRow> = {}): TestChatRow {
        return {
            id,
            scheduleId: over.scheduleId ?? null,
            scheduledAt: over.scheduledAt ?? null,
            planStart: over.planStart ?? null,
            planDurationDays: over.planDurationDays ?? null,
            wordOrder: over.wordOrder ?? [],
            seenQuizIds: over.seenQuizIds ?? [],
        };
    }

    private ensureChat(id: string): TestChatRow {
        return (this.state.chats[id] ??= this.blankChat(id));
    }

    private msgs(chatId: string): TimetableEntity<MessageTimetable>[] {
        return (this.state.messages[chatId] ??= []);
    }

    // region TimetableStore
    async saveTask(task: Task): Promise<void> {
        const chat = this.ensureChat(task.id);
        chat.scheduleId = task.scheduleId;
        chat.scheduledAt = task.scheduledAt;
    }

    async getTask(taskId: string): Promise<Task | undefined> {
        const chat = this.state.chats[taskId];
        if (!chat) return undefined;
        return { id: chat.id, scheduleId: chat.scheduleId, scheduledAt: chat.scheduledAt };
    }

    async addTimetable(taskId: string, timetable: TimetableEntity<MessageTimetable>): Promise<void> {
        this.msgs(taskId).push({ ...timetable, dates: [...timetable.dates] });
    }

    async getTimetablesBefore(taskId: string, before: Date): Promise<TimetableEntity<MessageTimetable>[]> {
        return this.msgs(taskId).filter(x => x.next != null && x.next <= before);
    }

    async getNextTimetableTime(taskId: string): Promise<Date | null> {
        let min: Date | null = null;
        for (const m of this.msgs(taskId)) {
            if (m.next == null) continue;
            if (!min || m.next < min) min = m.next;
        }
        return min;
    }

    async updateTimetable(taskId: string, id: string, patch: Partial<TimetableEntity<MessageTimetable>>): Promise<void> {
        const target = this.msgs(taskId).find(x => x.id === id);
        if (target) Object.assign(target, patch);
    }
    // endregion

    // region DataStore
    async getPlanState(chatId: string): Promise<{ planStart: Date; planDurationDays: number; wordOrder: string[] } | null> {
        const chat = this.state.chats[chatId];
        if (!chat?.planStart || chat.planDurationDays == null) return null;
        return { planStart: chat.planStart, planDurationDays: chat.planDurationDays, wordOrder: chat.wordOrder ?? [] };
    }

    async savePlanState(chatId: string, planStart: Date, planDurationDays: number, wordOrder: string[]): Promise<void> {
        const chat = this.ensureChat(chatId);
        chat.planStart = planStart;
        chat.planDurationDays = planDurationDays;
        chat.wordOrder = wordOrder;
    }

    async countMessagesByKind(chatId: string, kind: string): Promise<number> {
        return this.msgs(chatId).filter(x => x.kind === kind).length;
    }

    async deactivateTicks(chatId: string): Promise<void> {
        for (const m of this.msgs(chatId)) {
            if (m.kind === 'tick') m.next = null;
        }
    }

    async removeTimetablesByKind(chatId: string, kinds: string[]): Promise<void> {
        this.state.messages[chatId] = this.msgs(chatId).filter(x => !kinds.includes(x.kind as string));
    }

    async getMessagesByKind(chatId: string, kinds: string[]): Promise<TimetableEntity<MessageTimetable>[]> {
        return this.msgs(chatId).filter(x => kinds.includes(x.kind as string));
    }

    async pickTopForLevel(level: string, n: number): Promise<Word[]> {
        if (n <= 0) return [];
        const nulLast = (v: number | null | undefined) => (v == null ? -Infinity : v);
        return [...this.state.words]
            .sort((a, b) =>
                nulLast(b.satFrequency) - nulLast(a.satFrequency) ||
                nulLast(b.frequency) - nulLast(a.frequency) ||
                (a.level === level ? 0 : 1) - (b.level === level ? 0 : 1))
            .slice(0, n);
    }

    async getByIds(ids: string[]): Promise<Map<string, Word>> {
        const set = new Set(ids);
        return new Map(this.state.words.filter(w => set.has(w.id)).map(w => [w.id, w]));
    }
    // endregion
}
