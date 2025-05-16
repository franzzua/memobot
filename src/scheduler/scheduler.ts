import {SchedulerBackend} from "./shared";
import {Timetable} from "./types";
import {Task, SchedulerStorage, TimetableEntity} from "./storage/schedulerStorage";
import {TimetableHelper} from "./helpers/timetable.helper";

export class Scheduler<
    TimetableData = {},
    TaskId = string,
    ScheduleId = string,
> {
    constructor(
        private readonly storage: SchedulerStorage<TimetableData & Timetable, TaskId, ScheduleId>,
        private readonly queue: SchedulerBackend<TaskId, ScheduleId>,
    ) {
    }

    /**
     * Add timetable to existing task. If timetable have not future events - it's skipped.
     * @param taskId
     * @param timetable
     */
    async schedule(taskId: TaskId, timetable: TimetableData & Timetable): Promise<void> {
        const next = TimetableHelper.get(timetable).getNextTimeAfter(new Date());
        if (!next) return;
        const task = await this.storage.getTask(taskId) ?? {
            id: taskId,
            scheduledAt: null,
            scheduleId: null,
        } as Task<TaskId, ScheduleId>;
        if (!task.scheduledAt || task.scheduledAt > next){
            await this.updateTask(task, next);
        }
        await this.storage.addTimetable(taskId, {
            ...timetable,
            next: next,
            last: new Date(),
            invokeCounter: 0
        });
    }
    /**
     * Returns all not-processed timetable events and removes them
     * @param taskId
     * @param before new Date() by default
     */
    async getTaskState(taskId: TaskId, before: Date = new Date()): Promise<TaskHandle<TimetableData>> {
        const task = await this.storage.getTask(taskId)
        if (!task) return {
            unprocessed: [],
            markProcessed: () => Promise.resolve()
        };
        const timetables = await this.storage.getTimetablesBefore(taskId, before);
        const result: TaskHandle<TimetableData> = {
            unprocessed: [],
            markProcessed: async () => {
                let min: Date | null = null;
                for (const { data: timetable, dates} of result.unprocessed) {
                    const helper =  TimetableHelper.get(timetable);
                    const next = helper.getNextTimeAfter(before);
                    await this.storage.updateTimetable(taskId, timetable.id, {
                        next,
                        last: timetable.next,
                        invokeCounter: timetable.invokeCounter + dates.length
                    } as Partial<TimetableData & TimetableEntity>);
                    if (!next) continue;
                    if (!min || next < min)
                        min = next;
                }
                min = await this.storage.getNextTimetableTime(taskId) ?? min;
                await this.updateTask(task, min);
            }
        }
        for (const timetable of timetables) {
            const helper =  TimetableHelper.get(timetable);
            const invocations = helper.getTimesBetween(timetable.last, before);
            result.unprocessed.push({
                dates: invocations,
                data: timetable
            });
        }
        return result;
    }


    private async updateTask(entity: Task<TaskId, ScheduleId>, date: Date | null): Promise<void> {
        if (entity.scheduleId) {
            await this.queue.unschedule(entity.scheduleId);
        }
        entity.scheduledAt = date;
        entity.scheduleId = date ? await this.queue.scheduleTask(entity.id, date) : undefined;
        await this.storage.saveTask(entity);
    }
}

export type TaskHandle<TimetableData> = {
    unprocessed: Array<{
        data: TimetableEntity<TimetableData & Timetable>,
        dates: Date[]
    }>;
    markProcessed(): Promise<void>;
}