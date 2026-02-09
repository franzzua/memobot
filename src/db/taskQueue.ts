import { singleton } from "@di";
import { protos } from "@google-cloud/tasks";
import { gcsConfig } from "./gcs.config";
import { env } from "../env";
import process from "node:process";
import {GoogleTaskScheduler} from "../scheduler/queue/googleTaskScheduler";

// Instantiates a client.
@singleton()
export class TaskQueue extends GoogleTaskScheduler{
    constructor() {
        super({
            projectId: gcsConfig.projectId,
            location: gcsConfig.location,
            queueName: env.IsProd ? 'tasks' : 'tasksdev'
        });
    }

    getTaskInfo(taskId: string): Promise<Omit<protos.google.cloud.tasks.v2.ITask, "scheduleTime">> {
        return Promise.resolve({
            httpRequest: {
                url: process.env.PUBLIC_URL + '/task',
                body: Buffer.from(taskId).toString('base64'),
                headers: {
                    'Content-Type': 'text/plain', // Set content type to ensure compatibility your application's request parsing
                },
                httpMethod: 'POST',
            }
        })
    }

}