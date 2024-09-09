import { CommandContext } from "./types";
import { resolve } from "@di";
import { ChatDatabase } from "../db/chatDatabase";
import { TelegrafApi } from "./telegraf.api";
import { ChatState } from "../types";


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
                    {text: '/writeQuiz'},
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
export async function onQuizWrite(this: TelegrafApi, ctx: CommandContext){
    const [message] = await getRandomMessages.call(this, ctx, 1);
    await this.db.updateChatState(ctx.chat.id.toString(), ChatState.writeQuiz, {
        answer: message.content
    });
    return ctx.reply(
        `Write item for provided definition: '${message.details}'`
    );
}
export async function onQuizWriteAnswer(this: TelegrafApi, ctx: CommandContext, data: {
    answer: string;
}){
    await this.db.updateChatState(ctx.chat.id.toString(), ChatState.initial);
    const isRight = ctx.message.text == data.answer;
    if (isRight){
        return ctx.reply('Excellent!');
    } else {
        return ctx.reply(`You are wrong, right answer is \`${data.answer}\``);
    }
}

async function getRandomMessages(this: TelegrafApi, ctx: CommandContext, count: number){
    const messages = await this.db.getMessages(ctx.chat.id.toString(), true);
    const primeModulo = 442009;
    const random = Math.floor(Math.random()*messages.length);
    const randomMessages = Array(count).fill(0).map((_,i) => i)
        .map(x => (x * primeModulo + random) % messages.length)
        .map(x => messages[x]);
    return randomMessages;
}

async function quiz(this: TelegrafApi, ctx: CommandContext, reversed: boolean){
    const randomMessages = await getRandomMessages.call(this, ctx, 4);
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