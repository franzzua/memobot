import {baseFunction} from "./base";
import {di} from "@di";
import {Messenger} from "../messengers/messenger";
import {WhatsAppMessenger} from "../messengers/whatsAppMessenger";
import process from "node:process";
import {TelegrafApi} from "../api/telegraf.api";
import {getMessenger} from "./getMessenger";

const context = di.child();
context.factory(Messenger, c => getMessenger('whatsapp', c));

export const whatsapp = baseFunction('whatsapp', async (req, res) => {
    const tg = context.resolve(TelegrafApi);
    await tg.init();
    await tg.messenger.handle(req, res);
});