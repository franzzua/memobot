import { ChatState } from "../../types";
import { TelegrafApi } from "../telegraf.api";
import { CallbackEvent, IncomingMessageEvent } from "../../messengers/messenger";
import {setChatFromContext} from "./start";

export async function init(this: TelegrafApi, ctx: IncomingMessageEvent) {
    await setChatFromContext.call(this, ctx);
    return ctx.reply("What is your current English level?", {
        reply_markup: {
            inline_keyboard: [[
                { text: "A2", callback_data: "init:level:A2" },
                { text: "B1", callback_data: "init:level:B1" },
                { text: "B2", callback_data: "init:level:B2" },
            ]]
        }
    });
}

export async function onInitLevel(this: TelegrafApi, ctx: CallbackEvent) {
    const level = (ctx.data as string).replace("init:level:", "");
    await this.chatDatabase.updateChatState(ctx.chat.toString(), ChatState.initial, { level });
    return ctx.reply("How many months do you have to prepare for the SAT exam?", {
        reply_markup: {
            inline_keyboard: [[
                { text: "2 months", callback_data: "init:months:2" },
                { text: "3 months", callback_data: "init:months:3" },
                { text: "4 months", callback_data: "init:months:4" },
                { text: "5 months", callback_data: "init:months:5" },
            ]]
        }
    });
}

export async function onInitMonths(this: TelegrafApi, ctx: CallbackEvent) {
    const months = parseInt((ctx.data as string).replace("init:months:", ""), 10);
    const { stateData } = await this.chatDatabase.getChatState(ctx.chat.toString());
    const level = (stateData as any)?.level;
    await this.chatDatabase.updateChatState(ctx.chat.toString(), ChatState.initScore, { level, months });
    return ctx.reply("What is your target SAT score? (enter a number)");
}
