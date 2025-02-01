import process from "node:process";
import {inject, singleton} from "@di";
import {MemoBot} from "../bot/bot";
import {ChatDatabase} from "../db/chatDatabase";
import {Logger} from "telegram";
import {callbacks, commands} from "./commands/index";
import {Messenger} from "../messengers/messenger";
import {onAnyMessage} from "./commands/onAnyMessage";


if (!process.env.BOT_TOKEN)
    throw new Error(`BOT_TOKEN is not defined`);
if (!process.env.PUBLIC_URL)
    throw new Error(`WEBHOOK_ADDRESS is not defined`);

@singleton()
export class TelegrafApi {
    @inject(MemoBot)
    bot!: MemoBot;
    @inject(ChatDatabase)
    db!: ChatDatabase;

    @inject(Messenger)
    messenger!: Messenger;

    constructor() {
    }

    isInit = false;

    async init() {
        if (this.isInit) return;
        this.isInit = true;
        await this.messenger.init();
        this.messenger.on('message', async e => {
            const text = await e.text();
            if (text?.text?.startsWith('/')){
                const match = text?.text?.split(/[\s/]/g);
                const command = match?.[1];
                console.log(match, command)
                if (command && command in commands){
                    await commands[command].call(this, e);
                }
            } else {
                await onAnyMessage.call(this, e);
            }
            console.log('message', text);
        });
        this.messenger.on('callback', async e => {
            const query = e.data as string;
            if (query in callbacks) {
                return callbacks[query].call(this, e);
            }
        })
    }

    async [Symbol.asyncDispose]() {
        // this.stop();
    }

}
