import {di} from "@di";
import {TelegrafApi} from "../api/telegraf.api";
import {baseFunction} from "./base";
import {Messenger} from "../messengers/messenger";
import {getMessenger} from "./getMessenger";
import {Logger} from "../logger/logger";

const context = di.child();
context.factory(Messenger, c => getMessenger('telegram', c));
const tg = context.resolve(TelegrafApi);
console.log(context.resolve(Logger).constructor.name, di.resolve(Logger).constructor.name);
tg.init();

export const telegram = baseFunction('telegram', async (req, res) => {
    await tg.messenger.handle(req, res);
});

