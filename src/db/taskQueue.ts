import { inject, resolve, singleton } from "@di";
import { Task } from "../types";
import { TelegrafApi } from "../api/telegraf.api";
import { CloudTasksClient, protos } from "@google-cloud/tasks";
import { gcsConfig } from "./gcs.config";
import { Logger } from "../logger/logger";

// Instantiates a client.
@singleton()
export class TaskQueue {
    private get tg(){
        return resolve(TelegrafApi)
    }

    private client = new CloudTasksClient();
    private queue: protos.google.cloud.tasks.v2.IQueue | undefined;
    private async getQueue(){
        const q = await this.client.getQueue({
            name: this.client.queuePath( await this.client.getProjectId(), gcsConfig.location, 'tasks'),
        }).then(x => x[0]).catch(e => null);
        if (q) return q;
        return this.client.createQueue({
            parent: this.client.locationPath( await this.client.getProjectId(), gcsConfig.location),
            queue: {
                name: this.client.queuePath( await this.client.getProjectId(), gcsConfig.location, 'tasks'),
            }
        }).then(x => x[0])
    }

    private lastMessage: any | null = null;
    @Logger.measure
    async sendTask(task: Task, timeout = 0) {
        this.queue ??= await this.getQueue();
        this.lastMessage = await this.client.createTask({
            parent: this.queue.name,
            task: {
                scheduleTime: {seconds:+new Date()/1000 + timeout},
                httpRequest: {
                    url: this.tg.hookURL + "&task=1",
                    body: Buffer.from(JSON.stringify(task)).toString('base64'),
                    headers: {
                        'Content-Type': 'text/plain', // Set content type to ensure compatibility your application's request parsing
                    },
                    httpMethod: 'POST',
                }
            },
        });
    }
}