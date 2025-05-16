import { Timetable } from "src/scheduler/types";
import {TimetableEntity, SchedulerStorage, Task} from "../../storage/schedulerStorage";
import {scoped} from "@di";

@scoped()
export class SchedulerMockStorage implements SchedulerStorage {

    private storage = new Map<unknown, {
        task: Task;
        timetables: TimetableEntity[];
    }>();

    async addTask(task: Task): Promise<void> {
        this.storage.set(task.id, {
            task,
            timetables: []
        })
    }
    async saveTask(task: Task): Promise<void> {
        if (!this.storage.has(task.id))
            await this.addTask(task)
        else
            this.storage.get(task.id)!.task = task;
    }
    async deleteTask(taskId: unknown): Promise<void> {
        this.storage.delete(taskId);
    }
    async addTimetable(taskId: unknown, timetable: TimetableEntity): Promise<void> {
        this.storage.get(taskId)!.timetables.push(timetable);
    }
    async getTimetables(taskId: unknown, from: Date, to: Date | null): Promise<TimetableEntity[]> {
        return this.storage.get(taskId)!.timetables
            .filter(x => x.next && x.next > from && (!to || x.next <= to));
    }
    async getNextTimetableTime(taskId: unknown, from: Date): Promise<Date | null> {
        const timetables = await this.getTimetables(taskId, from, null);
        const times = timetables.map(x => x.next);
        let min: Date | null = null;
        for (let time of times) {
            if (!time) continue;
            if (!min || min > time) min = time;
        }
        return min;
    }
    async getTask(taskId: unknown): Promise<Task | undefined> {
        return this.storage.get(taskId)?.task;
    }
    async updateTimetable(taskId: string, id: any, patch: Partial<TimetableEntity<Timetable>>): Promise<void> {
        Object.assign(this.storage.get(taskId)?.timetables.find(x => x.id == id)!, patch);
    }


}