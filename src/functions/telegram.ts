import {di} from "@di";
import {TelegrafApi} from "../api/telegraf.api";
import {baseFunction} from "./base";
import {Messenger} from "../messengers/messenger";
import {getMessenger} from "./getMessenger";

const context = di.child();
context.factory(Messenger, c => getMessenger('telegram', c));

export const telegram = baseFunction('telegram', async (req, res) => {
    const tg = context.resolve(TelegrafApi);
    await tg.init();
    await tg.messenger.handle(req, res);
});

