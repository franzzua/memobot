import { TelegrafApi } from "../telegraf.api";
import { ChatState } from "../../types";
import {IncomingMessageEvent} from "../../messengers/messenger";
import { renderQuiz } from "../../services/quiz-render";
import { generateSatQuiz } from "../../services/sat-quiz-generator";
import { resolveWord } from "./wordReply";
import { pickDistractorWords } from "../../services/word-send-handlers";


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
    const chatId = ctx.chat.toString();
    const target = await resolveWord(ctx);

    if (target) {
        const distractors = await pickDistractorWords(chatId, target.id, 3);
        if (distractors.length >= 3) {
            const generated = await generateSatQuiz(target, distractors);
            if (generated) {
                for (const payload of renderQuiz({
                    id: '',
                    index: 0,
                    question: generated.question,
                    answers: generated.answers,
                    correct: generated.correct,
                    table_md: null,
                    attachment: null,
                } as any)) {
                    await ctx.reply(payload as any);
                }
                return;
            }
        }
    }

    const quiz = await this.chatDatabase.getRandomQuiz();
    if (!quiz) return ctx.reply('No quizzes available');
    for (const payload of renderQuiz(quiz)) {
        await ctx.reply(payload as any);
    }
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
        }
    });
}