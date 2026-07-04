import {describe, test, beforeEach, afterEach} from "node:test";
import {expect} from "expect";
import {PrismaStorage} from "./prismaStorage";
import {TimetablePolicyType} from "../scheduler/types";
import {prismaFactory} from "../../prisma/client";
import {storageContract} from "../scheduler/storage/storageContract";

const prisma = prismaFactory();

async function resetWithChat() {
    await prisma.message.deleteMany();
    await prisma.chat.deleteMany();
    await prisma.chat.create({
        data: {id: 'test-chat', username: 'test', userId: 'user1', state: 0, isPaused: false}
    });
}

describe("PrismaStorage", () => {
    const storage = new PrismaStorage();

    beforeEach(resetWithChat);
    afterEach(async () => { await prisma.$disconnect(); });

    test("saveTask updates scheduling info", async () => {
        const now = new Date();
        await storage.saveTask({id: 'test-chat', scheduleId: 'sched1', scheduledAt: now});

        const chat = await prisma.chat.findUnique({where: {id: 'test-chat'}});
        expect(chat?.scheduleId).toBe('sched1');
        expect(chat?.scheduledAt).toEqual(now);
    });

    test("addTimetable creates message", async () => {
        const now = new Date();
        await storage.addTimetable('test-chat', {
            id: 'msg1', content: 'hello', details: 'details', createdAt: now,
            number: 1, deleted: false, type: TimetablePolicyType.Dates,
            dates: [now], last: now, next: now, invokeCounter: 0
        } as any);

        const msg = await prisma.message.findUnique({where: {chatId_id: {chatId: 'test-chat', id: 'msg1'}}});
        expect(msg).toBeDefined();
        expect(JSON.parse(msg!.dates)).toHaveLength(1);
    });

    test("getTimetablesBefore returns relevant messages", async () => {
        const now = new Date();
        const future = new Date(now.getTime() + 10000);

        await storage.addTimetable('test-chat', {
            id: 'msg1', content: 'hello', details: 'details', createdAt: now,
            number: 1, deleted: false, type: TimetablePolicyType.Dates,
            dates: [], last: now, next: now, invokeCounter: 0
        } as any);
        await storage.addTimetable('test-chat', {
            id: 'msg2', content: 'hello2', details: 'details', createdAt: now,
            number: 2, deleted: false, type: TimetablePolicyType.Dates,
            dates: [], last: now, next: future, invokeCounter: 0
        } as any);

        const results = await storage.getTimetablesBefore('test-chat', new Date(now.getTime() + 1000));
        expect(results.length).toBe(1);
        expect(results[0].id).toBe('msg1');
    });
});

// Same contract the in-memory TestJsonStorage is checked against — proves parity.
storageContract('PrismaStorage', {
    create: async () => { await resetWithChat(); return new PrismaStorage(); },
    cleanup: async () => { await prisma.$disconnect(); },
});
