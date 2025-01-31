import {di} from "@di";
import {TelegrafApi} from "../api/telegraf.api";
import {baseFunction} from "./base";
import {Messenger} from "../messengers/messenger";
import {TelegramMessenger} from "../messengers/tg/telegram.messenger";
import process from "node:process";

const context = di.child();
context.factory(Messenger, c => c.resolve(TelegramMessenger, process.env.BOT_TOKEN!))

export const telegraf = baseFunction('telegraf', async (req, res) => {
    const tg = context.resolve(TelegrafApi);
    await tg.messenger.handle(req, res);
});

