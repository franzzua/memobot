import { defaultContainer, resolve } from "@di";
import { TelegrafApi } from "./api/telegraf.api";
import { Task } from "./types";
import process from "node:process";
import type { Request, Response } from "@google-cloud/functions-framework";
import { Logger } from "./logger/logger";
import { GCSLogger } from "./logger/gcs.logger";
defaultContainer.override(Logger, GCSLogger);
//
const tg = resolve(TelegrafApi);
const logger = resolve(Logger);
tg.run().catch(e => {
    console.error(e);
    process.exit(1);
});
export const telegraf = async (req: Request, res: Response) => {
    return logger.measure(async () => {
        if (req.query.secret !== tg.secretPath)
            return res.sendStatus(401);
        if (req.query.task){
            await tg.sendTask(JSON.parse(req.body) as Task);
        } else {
            tg.handleUpdate(req.body).catch(console.error);
        }
        res.sendStatus(204);
    }, 'request');
};