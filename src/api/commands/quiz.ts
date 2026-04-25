import { TelegrafApi } from "../telegraf.api";
import { ChatState } from "../../types";
import {IncomingMessageEvent} from "../../messengers/messenger";


export async function onQuiz(this: TelegrafApi, ctx: IncomingMessageEvent){
    const messages = await this.bot.getMessages(ctx.chat.toString(), true);
    if (messages.length < 4)
        return ctx.reply(`⚠️ Add new items to start quiz \n\n💡 <em>Start learning with</em> <b>/new</b>`);
    return ctx.reply('🗒 Choose a quiz', {
        reply_markup: {
            keyboard: [
                [
                    {text: '/directQuiz'},
                    {text: '/reversedQuiz'},
                    {text: '/writeQuiz'},
                ],
                [
                    {text: '/satQuiz'},
                ]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
}


export async function onQuizDirect(this: TelegrafApi, ctx: IncomingMessageEvent){
    return quiz.call(this, ctx, false);
}

export async function onQuizReversed(this: TelegrafApi, ctx: IncomingMessageEvent){
    return quiz.call(this, ctx, true);
}
export async function onQuizWrite(this: TelegrafApi, ctx: IncomingMessageEvent){
    const [message] = await getRandomMessages.call(this, ctx, 1);
    await this.chatDatabase.updateChatState(ctx.chat.toString(), ChatState.writeQuiz, {
        answer: message.content
    });
    return ctx.reply(
        `Write item for provided definition: '${message.details}'`
    );
}
export async function onQuizWriteAnswer(this: TelegrafApi, ctx: IncomingMessageEvent, data: {
    answer: string;
}){
    const message = await ctx.text();
    if (!message) return;
    await this.chatDatabase.updateChatState(ctx.chat.toString(), ChatState.initial);
    const isRight = message.text == data.answer;
    if (isRight){
        return ctx.reply('Excellent!');
    } else {
        return ctx.reply(`You are wrong, right answer is \`${data.answer}\``);
    }
}

export async function onDbQuiz(this: TelegrafApi, ctx: IncomingMessageEvent) {
    const quiz = await this.chatDatabase.getRandomQuiz();
    if (!quiz) return ctx.reply('No quizzes available in the database');

    const answers = quiz.answers as string[];
    const labels = ['A', 'B', 'C', 'D'];
    const optionsText = answers.map((a, i) => `${labels[i]}. ${a}`).join('\n');
    const questionHtml = formatQuestionHtml(quiz.question);

    return ctx.reply({
        type: 'text',
        text: `${questionHtml}\n\n${optionsText}`
    });
}

function formatQuestionHtml(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let blockquoteLines: string[] = [];

    for (const line of lines) {
        if (line.startsWith('> ')) {
            blockquoteLines.push(line.slice(2));
        } else {
            if (blockquoteLines.length > 0) {
                result.push(`<blockquote>${blockquoteLines.join('\n')}</blockquote>`);
                blockquoteLines = [];
            }
            result.push(line);
        }
    }
    if (blockquoteLines.length > 0) {
        result.push(`<blockquote>${blockquoteLines.join('\n')}</blockquote>`);
    }

    return result.join('\n').trim();
}

async function getRandomMessages(this: TelegrafApi, ctx: IncomingMessageEvent, count: number){
    const messages = await this.bot.getMessages(ctx.chat.toString(), true);
    const primeModulo = 442009;
    const random = Math.floor(Math.random()*messages.length);
    const randomMessages = Array(count).fill(0).map((_,i) => i)
        .map(x => (x * primeModulo + random) % messages.length)
        .map(x => messages[x]);
    return randomMessages;
}

async function quiz(this: TelegrafApi, ctx: IncomingMessageEvent, reversed: boolean){
    const randomMessages = await getRandomMessages.call(this, ctx, 4);
    const answerIndex = Math.floor(Math.random() * randomMessages.length);
    const answer = randomMessages[answerIndex];
    const question = reversed
        ? `Give item for definition '${answer.details}'`
        : `Give definition for item '${answer.content}`;
    return ctx.reply({
        type: 'quiz',
        question,
        answers: randomMessages.map(x => reversed ? x.content : x.details),
        options: {
            correct_option_id: answerIndex,
            allows_multiple_answers: false,
            open_period: 10,
        }
    });
}