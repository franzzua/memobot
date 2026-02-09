import {beforeEach, describe, test} from "node:test";
import {Scheduler} from "../scheduler";
import {SchedulerMockQueue} from "./mocks/SchedulerMockQueue";
import {SchedulerMockStorage} from "./mocks/SchedulerMockStorage";
import {TimetablePolicyType} from "../types";
import {expect} from "expect";

describe("scheduler", () => {
    let scheduler!: Scheduler<{ id: string }>;
    let queue: SchedulerMockQueue;
    let storage: SchedulerMockStorage

    const now = new Date();
    const dates = Array(10).fill(0).map((_, i) =>
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, i, 0, 0)
    );
    const [date1, date2] = dates;

    beforeEach(() => {
        scheduler = new Scheduler<{ id: string }, string, string>(
            storage = new SchedulerMockStorage(),
            queue = new SchedulerMockQueue()
        )
    });

    async function init(dates: Date[][]) {
        const taskId = 'task'
        for (let i = 0; i < dates.length; i++) {
            let date = dates[i];
            await scheduler.schedule(taskId, {
                id: `exec${i}`,
                type: TimetablePolicyType.Dates,
                dates: date
            });
        }
        return taskId;
    }

    function checkQueueNext(date: Date | undefined) {
        expect(queue.queue.values().next().value?.date).toBe(date);
    }

    test("1 timetable", async () => {
        const task = await init([[date1]]);
        checkQueueNext(date1);
        const timetables = await scheduler.getTaskState(task, date1);
        expect(timetables.unprocessed.length).toBe(1);
        expect(timetables.unprocessed[0].data.id).toBe(`exec0`);
    });

    test("2 timetable before", async () => {
        const task = await init([[date2], [date1]]);
        checkQueueNext(date1);
        let state = await scheduler.getTaskState(task, date1);
        expect(state.unprocessed.length).toBe(1);
        expect(state.unprocessed[0].data.id).toBe(`exec1`);
        checkQueueNext(date1);
        await state.markProcessed();
        checkQueueNext(date2);
        state = await scheduler.getTaskState(task, date2);
        expect(state.unprocessed.length).toBe(1);
        expect(state.unprocessed[0].data.id).toBe(`exec0`);
    });


    test("2 timetable after", async () => {
        const task = await init([[date1], [date2]]);
        checkQueueNext(date1);
        let state = await scheduler.getTaskState(task, date1);
        expect(state.unprocessed.length).toBe(1);
        expect(state.unprocessed[0].data.id).toBe(`exec0`);
        checkQueueNext(date1);
        await state.markProcessed();
        checkQueueNext(date2);
        state = await scheduler.getTaskState(task, date2);
        expect(state.unprocessed.length).toBe(1);
        expect(state.unprocessed[0].data.id).toBe(`exec1`);
    });
    test("2 timetable both", async () => {
        const task = await init([[date1], [date2]]);
        let state = await scheduler.getTaskState(task, date2);
        expect(state.unprocessed.length).toBe(2);
        expect(state.unprocessed[0].data.id).toBe(`exec0`);
        expect(state.unprocessed[1].data.id).toBe(`exec1`);
        await state.markProcessed();
        checkQueueNext(undefined);
    });
    test("many", async () => {
        const timetable1 = [dates[0], dates[3], dates[5], dates[8], dates[9]];
        const timetable2 = [dates[2], dates[3], dates[6], dates[7], dates[9]];
        const timetables = [timetable1, timetable2];
        const task = await init(timetables);
        for (let date of dates) {
            let state = await scheduler.getTaskState(task, date);
            const filter = timetables.filter(x => x.includes(date));
            expect(state.unprocessed.length).toBe(filter.length);
            await state.markProcessed();
        }
    });
})