import {di} from "@di";
import {TelegrafApi} from "../api/telegraf.api";
import {baseFunction} from "./base";
import {Messenger} from "../messengers/messenger";
import {getMessenger} from "./getMessenger";

let tg: TelegrafApi;
export async function initTelegram() {
    const context = di.child();
    context.factory(Messenger, c => getMessenger('telegram', c));
    tg = context.resolve(TelegrafApi);
    await tg.init();
}

export const telegram = Object.assign(
    baseFunction('telegram', async (req, res) => {
        await tg.messenger.handle(req, res);
    }), {
        init: initTelegram
    });

