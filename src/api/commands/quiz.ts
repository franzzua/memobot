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
    const msg = await ctx.text();
    const indexArg = msg?.text?.match(/\/\w+\s+(\d+)/)?.[1];
    const quiz = indexArg !== undefined
        ? await this.chatDatabase.getQuizByIndex(parseInt(indexArg, 10))
        : await this.chatDatabase.getRandomQuiz();
    if (!quiz) return ctx.reply('No quizzes available in the database');

    const { description, pollQuestion } = splitQuestion(quiz.question);

    if (description) {
        await ctx.reply({ type: 'text', text: formatQuestionHtml(description) });
    }

    if (quiz.attachment) {
        await ctx.reply({ type: 'image', image: Buffer.from(quiz.attachment) });
    } else if (quiz.table_md) {
        await ctx.reply({ type: 'text', text: `<pre>${quiz.table_md}</pre>` });
    }

    const labels = ['A', 'B', 'C', 'D'];
    const answers = quiz.answers as string[];
    const longOptions = answers.some(a => a.length > 100);

    if (longOptions) {
        const optionsText = answers.map((a, i) => `<b>${labels[i]}.</b> ${a}`).join('\n\n');
        await ctx.reply({ type: 'text', text: optionsText });
    }

    return ctx.reply({
        type: 'quiz',
        question: pollQuestion,
        answers: longOptions ? labels : answers,
        options: {
            correct_option_id: quiz.correct,
            allows_multiple_answers: false,
            open_period: 10,
        }
    });
}

function splitQuestion(text: string): { description: string; pollQuestion: string } {
    const lastBreak = text.lastIndexOf('\n\n');
    if (lastBreak !== -1) {
        return {
            description: text.slice(0, lastBreak).trim(),
            pollQuestion: text.slice(lastBreak + 2).trim(),
        };
    }
    const match = text.match(/^([\s\S]+[.!?])\s+([^.!?]+[?])$/);
    if (match) {
        return { description: match[1].trim(), pollQuestion: match[2].trim() };
    }
    return { description: '', pollQuestion: text.trim() };
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