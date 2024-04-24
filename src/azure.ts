import { resolve } from "@di";
import { TelegrafApi } from "./api";
import { app } from "@azure/functions";
import { Task } from "./types";
import process from "node:process";

const tg = resolve(TelegrafApi);
tg.run();
const fnName = tg.secretPath;
app.http(fnName, {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);
        context.log('body 2');
        try{
            await tg.handleUpdate(await request.json() as any);
        } catch(e: any) {
            context.log(e.message);
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
})
console.log('register function', fnName);