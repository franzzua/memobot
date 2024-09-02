import { CommandContext } from "./types";
import { resolve } from "@di";
import { ChatDatabase } from "../db/chatDatabase";
import { TelegrafApi } from "./telegraf.api";


export async function onQuiz(this: TelegrafApi, ctx: CommandContext){
    const messages = await this.db.getMessages(ctx.chat.id.toString(), true);
    if (messages.length < 4)
        return ctx.reply(`⚠️ Add new items to start quiz \n\n💡 <em>Start learning with</em> <b>/new</b>`,{
            parse_mode: 'HTML'
        });
    return ctx.reply('🗒 Choose a quiz', {
        reply_markup: {
            keyboard: [
                [
                    {text: '/directQuiz'},
                    {text: '/reversedQuiz'},
                ]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
}


export async function onQuizDirect(this: TelegrafApi, ctx: CommandContext){
    return quiz.call(this, ctx, false);
}

export async function onQuizReversed(this: TelegrafApi, ctx: CommandContext){
    return quiz.call(this, ctx, true);
}


async function quiz(this: TelegrafApi, ctx: CommandContext, reversed: boolean){
    const messages = await this.db.getMessages(ctx.chat.id.toString(), true);
    const primeModulo = 442009;
    const random = Math.floor(Math.random()*messages.length);
    const randomMessages = [0,1,2,3]
        .map(x => (x * primeModulo + random) % messages.length)
        .map(x => messages[x]);
    const answerIndex = Math.floor(Math.random() * randomMessages.length);
    const answer = randomMessages[answerIndex];
    const question = reversed
        ? `Give item for definition '${answer.details}'`
        : `Give definition for item '${answer.content}`;
    return ctx.replyWithQuiz(
        question,
        randomMessages.map(x => reversed ? x.content : x.details),
        {
            correct_option_id: answerIndex,
            allows_multiple_answers: false,
            open_period: 10,
        }
    );
}