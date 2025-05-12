import {di} from "@di";
import {TelegrafApi} from "../api/telegraf.api";
import {baseFunction} from "./base";
import {Messenger} from "../messengers/messenger";
import {getMessenger} from "./getMessenger";
import {Logger} from "../logger/logger";

let tgLoad: Promise<TelegrafApi>;

async function initTelegram() {
    const context = di.child();
    context.factory(Messenger, c => getMessenger('telegram', c));
    const tg = context.resolve(TelegrafApi);
    console.log('resolved:', context.resolve(Logger).constructor.name);
    await tg.init();
    return tg;
}

export const telegram = baseFunction('telegram', async (req, res) => {
    const tg = await (tgLoad ??= initTelegram());
    if (req && res)
        await tg.messenger.handle(req, res);
});

