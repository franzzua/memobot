import {describe, test, beforeEach, afterEach} from "node:test";
import {expect} from "expect";
import {DataStore} from "./dataStore";
import {TimetableEntity} from "./schedulerStorage";
import type {MessageTimetable} from "../../db/messagesDatabase";
import {TimetablePolicyType} from "../types";

export type StorageContractHooks = {
    /** Return a fresh store whose chat `chatId` already exists. */
    create(): Promise<DataStore> | DataStore;
    cleanup?(): Promise<void> | void;
    chatId?: string;
};

function entity(id: string, next: Date | null): TimetableEntity<MessageTimetable> {
    return {
        id, content: 'c', details: 'd', createdAt: new Date(), number: 0, deleted: false,
        type: TimetablePolicyType.Dates, dates: [], kind: 'memo', refId: null,
        last: new Date(), next, invokeCounter: 0,
    } as unknown as TimetableEntity<MessageTimetable>;
}

/**
 * Behavioral contract every {@link DataStore} implementation must satisfy. Run against both
 * `PrismaStorage` (integration) and `TestJsonStorage` (unit) so the in-memory test double
 * provably agrees with the real Postgres backend on the core timetable operations.
 */
export function storageContract(label: string, hooks: StorageContractHooks) {
    const chatId = hooks.chatId ?? 'test-chat';
    describe(`DataStore contract: ${label}`, () => {
        let store: DataStore;
        beforeEach(async () => { store = await hooks.create(); });
        afterEach(async () => { await hooks.cleanup?.(); });

        test("saveTask + getTask round-trip", async () => {
            const now = new Date();
            await store.saveTask({id: chatId, scheduleId: 'sched1', scheduledAt: now});
            const task = await store.getTask(chatId);
            expect(task?.scheduleId).toBe('sched1');
            expect(task?.scheduledAt?.getTime()).toBe(now.getTime());
        });

        test("getTimetablesBefore returns only rows due at/before the cutoff", async () => {
            const now = new Date();
            const future = new Date(+now + 10_000);
            await store.addTimetable(chatId, entity('m1', now));
            await store.addTimetable(chatId, entity('m2', future));
            const due = await store.getTimetablesBefore(chatId, new Date(+now + 1_000));
            expect(due.map(x => x.id)).toEqual(['m1']);
        });

        test("getNextTimetableTime is the min next; clearing a row advances it", async () => {
            const now = new Date();
            const future = new Date(+now + 10_000);
            await store.addTimetable(chatId, entity('m1', now));
            await store.addTimetable(chatId, entity('m2', future));
            expect((await store.getNextTimetableTime(chatId))?.getTime()).toBe(now.getTime());
            await store.updateTimetable(chatId, 'm1', {next: null});
            expect((await store.getNextTimetableTime(chatId))?.getTime()).toBe(future.getTime());
        });
    });
}
