import { defaultContainer, resolve } from "@di";
import { TelegrafApi } from "./api/telegraf.api";
import { Task } from "./types";
import process from "node:process";
import type { Request, Response } from "@google-cloud/functions-framework";
import { Logger } from "./logger/logger";
import { GCSLogger } from "./logger/gcs.logger";
import { MemoBot } from "./bot/bot";
defaultContainer.override(Logger, GCSLogger);
//
const tg = resolve(TelegrafApi);
const bot = resolve(MemoBot);
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
            await bot.sendTask({
                ...task,
                index: task.index + 1
            });
            return res.sendStatus(204);
        }
        await tg.handleUpdate(req.body, res).catch(console.error);
    }, 'request').catch();
};