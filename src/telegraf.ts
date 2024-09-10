import type { Request, Response } from "@google-cloud/functions-framework";
import { ServerResponse } from "node:http";
import { resolve } from "@di";
import { Logger } from "./logger/logger";
import { TelegrafApi } from "./api/telegraf.api";
import { ChatDatabase } from "./db/chatDatabase";

export const telegraf = async (
    req: Pick<Request, "body"|"query">,
    res: Pick<Response, "sendStatus"> & ServerResponse
) => {
    const logger = resolve(Logger);
    const tg = resolve(TelegrafApi);
    const db = resolve(ChatDatabase);
    return logger.measure(async () => {
        console.log(req.query);
        if (req.query.secret !== tg.secretPath)
            return res.sendStatus(401);
        if (req.query.task) {
            const chatId = req.body;
            const isSucceed = await tg.sendTasks(chatId);
            if (isSucceed){
                console.log('secceed, return 204')
                return res.sendStatus(204);
            } else {
                return res.sendStatus(418);
            }
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