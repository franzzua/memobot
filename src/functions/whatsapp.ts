import {baseFunction} from "./base";
import {di} from "@di";
import {Messenger} from "../messengers/messenger";
import {WhatsAppMessenger} from "../messengers/whatsAppMessenger";
import process from "node:process";
import {TelegrafApi} from "../api/telegraf.api";

export const whatsapp = baseFunction('whatsapp', async (req, res) => {
    const context = di.child();
    context.factory(Messenger, c => c.resolve(WhatsAppMessenger, process.env.WA_PHONE_NUMBER_ID!, process.env.SYSTEM_USER_TOKEN!))
    const tg = context.resolve(TelegrafApi);
    await tg.init();
    await tg.messenger.handle(req, res);
});