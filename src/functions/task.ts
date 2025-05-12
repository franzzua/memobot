import {baseFunction} from "./base";
import {resolve} from "@di";
import {TaskSender} from "../services/task-sender";
import {MemoBot} from "../bot/bot";
import {ChatDatabase} from "../db/chatDatabase";
import {getMessenger} from "./getMessenger";

export const task = baseFunction('task', async (req, res) => {
    if (!req || !res) return;
    const taskSender = resolve(TaskSender);
    const bot = resolve(MemoBot);
    const chatDb = resolve(ChatDatabase);
    const chatId = req.body;
    const messengerName = await chatDb.getChatMessenger(chatId);
    const messenger = getMessenger(messengerName)!;
    const isSucceed = await taskSender.sendTasks(messenger, chatId);
    if (isSucceed) {
        await bot.enqueueTasks(chatId);
        console.log('succeed, return 204')
        return res.sendStatus(204);
    } else {
        return res.sendStatus(418);
    }
});