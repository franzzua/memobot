import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {resolve} from "@cmmn/core";
import {SrsPlanner} from "../../services/srs-planner";

export async function forceNext(this: TelegrafApi, ctx: IncomingMessageEvent) {
    const result = await resolve(SrsPlanner).advance(ctx.chat.toString());
    if (!result.scheduledWord && !result.scheduledQuiz) {
        return ctx.reply('No more items to advance. Run /init first or you have completed the plan.');
    }
    const parts: string[] = [];
    if (result.scheduledWord) parts.push(`word "${result.scheduledWord.word}"`);
    if (result.scheduledQuiz) parts.push('a quiz');
    return ctx.reply(`Scheduled ${parts.join(' and ')}.`);
}
