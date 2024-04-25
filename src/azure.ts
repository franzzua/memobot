import { resolve } from "@di";
import { TelegrafApi } from "./api";
import { app } from "@azure/functions";
import { Task } from "./types";
import process from "node:process";

const tg = resolve(TelegrafApi);
tg.run();
app.http('telegraf', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: tg.secretPath,
    handler: async (request, context) => {
        try{
            await tg.handleUpdate(await request.json() as any);
        } catch(e: any) {
            context.error('Error:', e?.message ?? e);
        }
        return { body: null }
    }
});
app.storageQueue('tasks', {
    handler: async (entry: any, context) => {
        await tg.sendTask(entry as Task);
    },
    connection: 'QUEUE_CONNECTION_STRING',
    queueName: process.env.QUEUE_NAME!
});