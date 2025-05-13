import {di} from "@di";
import {TelegrafApi} from "../api/telegraf.api";
import {baseFunction} from "./base";
import {Messenger} from "../messengers/messenger";
import {getMessenger} from "./getMessenger";

let tgLoad: Promise<TelegrafApi>;

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

export const telegram = baseFunction('telegram', async (req, res) => {
    const tg = await tgLoad;
    if (req && res) {
        if (req.path.startsWith('/tasks')){
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

