import {SchedulerBackend} from "../../shared";
import {scoped} from "@di";

@scoped()
export class SchedulerMockQueue implements SchedulerBackend {

    queue = new Map<string, { date: Date, taskId: string }>();

    async scheduleTask(taskId: string, date: Date): Promise<string> {
        const id = Math.random().toString(36).substring(2);
        this.queue.set(id, { date, taskId });
        return id;

    }
    async unschedule(id: string): Promise<void> {
        this.queue.delete(id);
    }

}