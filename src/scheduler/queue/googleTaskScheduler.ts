import {SchedulerBackend} from "../shared";
import {CloudTasksClient, protos} from "@google-cloud/tasks";

export abstract class GoogleTaskScheduler<TaskId = string> implements SchedulerBackend<TaskId> {

    private client = new CloudTasksClient({
        projectId: this.config.projectId
    });
    private queue: protos.google.cloud.tasks.v2.IQueue | undefined;

    private async getQueue() {
        const name = this.client.queuePath(this.config.projectId, this.config.location, this.config.queueName);
        const q = await this.client.getQueue({
            name,
        }).then(x => x[0]).catch(e => null);
        if (q) return q;
        return this.client.createQueue({
            parent: this.client.locationPath(this.config.projectId, this.config.location),
            queue: {
                name,
            }
        }).then(x => x[0])
    }

    protected constructor(private config: {
        projectId: string;
        location: string;
        queueName: string;
    }) {
    }


    async scheduleTask(taskId: TaskId, date: Date): Promise<string> {
        this.queue ??= await this.getQueue();
        const [result] = await this.client.createTask({
            parent: this.queue.name,
            task: {
                scheduleTime: {seconds: +date / 1000},
                ...await this.getTaskInfo(taskId)
            },
        });
        return result.name!;
    }

    async unschedule(name: string) {
        await this.client.deleteTask({
            name
        }).catch(e => {
        });
    }

    abstract getTaskInfo(taskId: TaskId): Promise<Omit<protos.google.cloud.tasks.v2.ITask, "scheduleTime">>;
}