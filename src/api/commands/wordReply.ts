import {TelegrafApi} from "../telegraf.api";
import {AudioMessage, ImageMessage, IncomingMessageEvent, QuizMessage} from "../../messengers/messenger";
import {resolve} from "@cmmn/core";
import {WordsDatabase} from "../../db/wordsDatabase";
import {TextToSpeech} from "../../services/text-to-speech";
import {AiModel} from "../../services/ai-model";
import {Imagen} from "../../services/imagen";
import {PrismaStorage} from "../../db/prismaStorage";
import {TaskScheduler} from "../../db/task.scheduler";
import type {Word} from "../../../prisma/client";
import {pickDistractorWords} from "../../services/word-send-handlers";
import {generateSatQuiz} from "../../services/sat-quiz-generator";
import {renderQuiz} from "../../services/quiz-render";
import {ImageRender} from "../../services/image-render";
import {transcriptionPrompt, examplePrompt, imagePrompt} from "../../services/prompts";

const KEYWORDS = ['voice', 'example', 'image', 'skip', 'wordquiz', 'satquiz', 'card'] as const;
type Keyword = typeof KEYWORDS[number];

function isKeyword(value: string): value is Keyword {
    return (KEYWORDS as readonly string[]).includes(value);
}

function parseKeyword(text: string): {keyword: Keyword; force: boolean} | null {
    const [kw, modifier] = text.trim().toLowerCase().split(/\s+/);
    if (!isKeyword(kw)) return null;
    return {keyword: kw, force: modifier === 'force'};
}

function extractWord(botText: string): string | undefined {
    const firstLine = botText.split('\n')[0]?.trim();
    if (!firstLine) return undefined;
    const stripped = firstLine.replace(/^word\s*:\s*/i, '').trim();
    return stripped || undefined;
}

export async function resolveWord(e: IncomingMessageEvent): Promise<Word | null> {
    const wordsDb = resolve(WordsDatabase);
    if (e.replyTo?.isBot && e.replyTo.text) {
        const candidate = extractWord(e.replyTo.text);
        if (candidate) {
            const word = await wordsDb.getWord(candidate);
            if (word) return word;
        }
    }
    const lastId = await resolve(PrismaStorage).getLastSentWordRefId(e.chat.toString());
    if (!lastId) return null;
    return wordsDb.getById(lastId);
}

async function ensureTranscription(word: Word, force = false): Promise<string> {
    const existing = word.transcription?.trim();
    if (existing && !force) return existing;
    const ipa = await resolve(AiModel).prompt(transcriptionPrompt(word.word));
    const transcription = (ipa ?? '').trim();
    if (transcription) await resolve(WordsDatabase).setTranscription(word.id, transcription);
    return transcription;
}

async function ensureExample(word: Word, force = false): Promise<string> {
    const existing = word.example?.trim();
    if (existing && !force) return existing;
    const sentence = await resolve(AiModel).prompt(examplePrompt(word.word, word.description));
    const example = (sentence ?? '').trim();
    if (example) await resolve(WordsDatabase).setExample(word.id, example);
    return example;
}

async function ensureImage(word: Word, force = false): Promise<{image: Buffer | undefined, example: string}> {
    if (word.image && !force) return {image: Buffer.from(word.image), example: word.example?.trim() ?? ''};
    const example = await ensureExample(word, force);
    const image = await resolve(Imagen).generate(imagePrompt(example));
    if (image) await resolve(WordsDatabase).setImage(word.id, image);
    return {image, example};
}

async function ensureVoice(word: Word, ipa?: string, force = false): Promise<Buffer> {
    if (word.voice && !force) return Buffer.from(word.voice);
    const audio = await resolve(TextToSpeech).getStream(word.word, 'ogg_opus', ipa || undefined);
    await resolve(WordsDatabase).setVoice(word.id, audio);
    return audio;
}

export async function tryHandleWordReply(this: TelegrafApi, e: IncomingMessageEvent): Promise<boolean> {
    const text = (await e.text())?.text;
    if (!text) return false;
    const parsed = parseKeyword(text);
    console.log('[wordReply] text:', JSON.stringify(text), 'parsed:', JSON.stringify(parsed));
    if (!parsed) return false;
    const {keyword, force} = parsed;
    const word = await resolveWord(e);
    console.log('[wordReply] keyword:', keyword, 'word:', word?.word ?? null);
    if (!word) return false;
    switch (keyword) {
        case 'voice': {
            const transcription = await ensureTranscription(word, force);
            const audio = await ensureVoice(word, transcription, force);
            await e.reply({
                type: 'audio',
                audio,
                audioType: 'ogg',
                caption: transcription || undefined,
            } as AudioMessage, {replyTo: e.id});
            return true;
        }
        case 'example': {
            const sentence = await ensureExample(word, force);
            await e.reply(sentence ? `<i>${sentence}</i>` : `Cannot create example for ${word.word}`, {replyTo: e.id});
            return true;
        }
        case 'image': {
            const {image, example} = await ensureImage(word, force);
            if (!image) {
                await e.reply(`Cannot generate image for ${word.word}`, {replyTo: e.id});
                return true;
            }
            const caption = `<b>${word.word}</b>${example ? `\n<span class="tg-spoiler"><i>${example}</i></span>` : ''}`;
            await e.reply({type: 'image', image, caption} as ImageMessage, {replyTo: e.id});
            return true;
        }
        case 'skip': {
            await resolve(TaskScheduler).unschedule(e.chat.toString(), `word.${word.id}`);
            await e.reply(`Skipped ${word.word}`, {replyTo: e.id});
            return true;
        }
        case 'wordquiz': {
            const chatId = e.chat.toString();
            const distractors = await pickDistractorWords(chatId, word.id, 3);
            console.log('[wordReply] wordquiz distractors:', distractors.length);
            if (distractors.length < 3) {
                await e.reply(`<b>${word.word}</b>\n${word.description ?? ''}`, {replyTo: e.id});
                return true;
            }
            const pool = [word, ...distractors];
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            const correct = pool.findIndex(w => w.id === word.id);
            await e.reply({
                type: 'quiz',
                question: word.description ?? word.word,
                answers: pool.map(w => w.word),
                options: {correct_option_id: correct, allows_multiple_answers: false},
            } as QuizMessage, {replyTo: e.id});
            return true;
        }
        case 'satquiz': {
            const chatId = e.chat.toString();
            const distractors = await pickDistractorWords(chatId, word.id, 3);
            if (distractors.length < 3) {
                await e.reply(`Not enough words for SAT quiz yet`, {replyTo: e.id});
                return true;
            }
            const generated = await generateSatQuiz(word, distractors);
            if (!generated) {
                await e.reply(`Could not generate SAT quiz for ${word.word}`, {replyTo: e.id});
                return true;
            }
            for (const payload of renderQuiz({
                id: '', index: 0, table_md: null, attachment: null,
                question: generated.question,
                answers: generated.answers,
                correct: generated.correct,
            } as any)) {
                await e.reply(payload as any);
            }
            return true;
        }
        case 'card': {
            const render = new ImageRender(word.word, word.description ?? '');
            await e.reply({type: 'image', image: render.render()} as ImageMessage, {replyTo: e.id});
            return true;
        }
    }
    return false;
}
