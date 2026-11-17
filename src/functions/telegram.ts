import {di} from "@cmmn/core";
import {TelegrafApi} from "../api/telegraf.api";
import {baseFunction} from "./base";
import {Messenger} from "../messengers/messenger";
import {getMessenger} from "./getMessenger";
import {prismaFactory} from "../../prisma/client";
import { PrismaClient } from "../../prisma/client";
import {isAdminRequest, handleAdminRequest} from "../api/admin";
import {DataStore} from "../scheduler/storage/dataStore";
import {PrismaStorage} from "../db/prismaStorage";
import {Scheduler} from "../scheduler/scheduler";
import {TaskScheduler} from "../db/task.scheduler";
import {DuelDeps, handleDuelRequest, isDuelRequest, Notifier} from "../duel/api";
import {duelDeps, openGameButton} from "../duel/wiring";
import {TelegramMessenger} from "../messengers/tg/telegram.messenger";

let tgLoad: Promise<TelegrafApi>;
di.factory(PrismaClient, prismaFactory)
// Bind the scheduler's abstract ports to their Prisma-backed implementations, so
// SrsPlanner (which resolves DataStore/Scheduler) works from every entrypoint.
di.override(DataStore, PrismaStorage)
di.override(Scheduler as any, TaskScheduler)

async function initTelegram() {
    const context = di.child();
    context.factory(Messenger, c => getMessenger('telegram', c));
    const tg = context.resolve(TelegrafApi);
    await tg.init().catch(console.error);
    return tg;
}

export function init(){
    tgLoad = initTelegram();
}

// "Your move" messages for Word Duel go through the bot's Telegraf client.
const duelNotifier: Notifier = {
    async send(userId, html, duelId, replaces) {
        const bot = ((await (tgLoad ??= initTelegram())).messenger as TelegramMessenger).tg.telegram;
        if (replaces) await bot.deleteMessage(userId, replaces).catch(() => undefined);
        const msg = await bot.sendMessage(userId, html, {parse_mode: 'HTML', reply_markup: openGameButton(duelId)});
        return msg.message_id;
    },
    async botUsername() {
        const tg = ((await (tgLoad ??= initTelegram())).messenger as TelegramMessenger).tg;
        return tg.botInfo?.username ?? (tg.botInfo = await tg.telegram.getMe()).username;
    },
};
let duel: DuelDeps | undefined;
export const getDuelDeps = () => duel ??= duelDeps(duelNotifier);

export const telegram = baseFunction('telegram', async (req, res) => {
    if (req && res && isAdminRequest(req.path)) {
        return handleAdminRequest(req, res);
    }
    if (req && res && isDuelRequest(req.path)) {
        return handleDuelRequest(req, res, getDuelDeps());
    }
    const tg = await (tgLoad ??= initTelegram());
    if (req && res) {
        if (req.path.startsWith('/task')){
            const chatId = req.body;
            const isSucceed = await tg.invokeTask(chatId);
            if (isSucceed) {
                return res.sendStatus(204);
            } else {
                return res.sendStatus(418);
            }
        }
        await tg.messenger.handle(req, res);
    }
});

