import { defaultContainer, resolve } from "@di";
import { TelegrafApi } from "./api/telegraf.api";
import { Task } from "./types";
import process from "node:process";
import type { Request, Response } from "@google-cloud/functions-framework";
import { Logger } from "./logger/logger";
import { MemoBot } from "./bot/bot";
import { ConsoleLogger } from "./logger/console.logger";
import { TaskDatabase } from "./db/taskDatabase";
defaultContainer.override(Logger, ConsoleLogger);
//
const tg = resolve(TelegrafApi);
const bot = resolve(MemoBot);
const db = resolve(TaskDatabase);
const logger = resolve(Logger);
tg.run().catch(e => {
    console.error(e);
    process.exit(1);
});
export const telegraf = async (req: Request, res: Response) => {
    return logger.measure(async () => {
        if (req.query.secret !== tg.secretPath)
            return res.sendStatus(401);
        if (req.query.task) {
            const task = JSON.parse(req.body) as Task;
            await tg.sendTask(task);
            await db.increaseProgress(task.chatId, task.messageId);
            await bot.sendTask({
                ...task,
                index: task.index + 1
            });
            return res.sendStatus(204);
        }
        if (req.body.my_chat_member){
            // strange begaviour
            return ;
            const data = req.body.my_chat_member;
            switch (data.new_chat_member.status){
                case "kicked":
                    if (data.new_chat_member.user.id == tg.botInfo?.id){
                        console.log(data.new_chat_member);
                        console.log(data.old_chat_member);
                        await db.removeChat(data.chat.id.toString());
                        return;
                    }
                    break;
            }
        }
        if (req.body.message) {
            await tg.handleUpdate(req.body, res).catch(console.error);
            return;
        }
        if (req.body.callback_query) {
            await tg.handleUpdate(req.body, res).catch(console.error);
            return;
        }
        console.log(req.body);
        await tg.handleUpdate(req.body, res).catch(console.error);
    }, 'request').catch();
};