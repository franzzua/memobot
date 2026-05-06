import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {resolve} from "@cmmn/core";
import {SrsPlanner} from "../../services/srs-planner";
import {renderPlanHistogram} from "../../services/histogram-render";

export async function histo(this: TelegrafApi, ctx: IncomingMessageEvent) {
    const chatId = ctx.chat.toString();
    const {words, quizzes} = await resolve(SrsPlanner).projectPlan(chatId);

    if (words.length === 0 && quizzes.length === 0) {
        return ctx.reply('No plan yet. Run /init to build one.');
    }

    return ctx.reply({
        type: 'image',
        image: renderPlanHistogram(words, quizzes),
    });
}
