import {baseFunction} from "./base";
import {resolve} from "@di";
import {TaskSender} from "../services/task-sender";
import {MemoBot} from "../bot/bot";

export const task = baseFunction('task', async (req, res) => {
    const taskSender = resolve(TaskSender);
    const bot = resolve(MemoBot);
    const chatId = req.body;
    const isSucceed = await taskSender.sendTasks(chatId);
    if (isSucceed) {
        await bot.enqueueTasks(chatId);
        console.log('succeed, return 204')
        return res.sendStatus(204);
    } else {
        return res.sendStatus(418);
    }
});