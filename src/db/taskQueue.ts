import { resolve, singleton } from "@di";
import { TelegrafApi } from "../api/telegraf.api";
import { CloudTasksClient, protos } from "@google-cloud/tasks";
import { gcsConfig } from "./gcs.config";
import { Logger } from "../logger/logger";
import { env } from "../env";

// Instantiates a client.
@singleton()
export class TaskQueue {
    private get tg(){
        return resolve(TelegrafApi)
    }

    private client = new CloudTasksClient({
        projectId: gcsConfig.projectId
    });
    private queue: protos.google.cloud.tasks.v2.IQueue | undefined;
    private async getQueue(){
        const projectId = await this.client.getProjectId();
        const name = this.client.queuePath(projectId, gcsConfig.location, env.IsProd ? 'tasks' : 'tasksdev');
        const q = await this.client.getQueue({
            name,
        }).then(x => x[0]).catch(e => null);
        if (q) return q;
        return this.client.createQueue({
            parent: this.client.locationPath(projectId, gcsConfig.location),
            queue: {
                name,
            }
        }).then(x => x[0])
    }

    @Logger.measure
    async sendTask(chatId: string, timeout = 0): Promise<string> {
        this.queue ??= await this.getQueue();
        const [task] = await this.client.createTask({
            parent: this.queue.name,
            task: {
                scheduleTime: {seconds:+new Date()/1000 + timeout},
                httpRequest: {
                    url: this.tg.hookURL + "&task=1",
                    body: Buffer.from(chatId).toString('base64'),
                    headers: {
                        'Content-Type': 'text/plain', // Set content type to ensure compatibility your application's request parsing
                    },
                    httpMethod: 'POST',
                }
            },
        });
        return task.name!;
    }

    async deleteTask(name: string) {
        console.log('delete task', name);
        await this.client.deleteTask({
            name
        }).catch(e => {});
    }
}