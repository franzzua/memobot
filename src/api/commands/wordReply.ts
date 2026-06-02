import {TelegrafApi} from "../telegraf.api";
import {AudioMessage, ImageMessage, IncomingMessageEvent} from "../../messengers/messenger";
import {resolve} from "@cmmn/core";
import {WordsDatabase} from "../../db/wordsDatabase";
import {TextToSpeech} from "../../services/text-to-speech";
import {AiModel} from "../../services/ai-model";
import {Imagen} from "../../services/imagen";
import {PrismaSchedulerStorage} from "../../db/prismaSchedulerStorage";
import {TaskScheduler} from "../../db/task.scheduler";
import type {Word} from "../../../prisma/client";

const KEYWORDS = ['voice', 'example', 'image', 'skip'] as const;
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
    const lastId = await resolve(PrismaSchedulerStorage).getLastSentWordRefId(e.chat.toString());
    if (!lastId) return null;
    return wordsDb.getById(lastId);
}

async function ensureTranscription(word: Word, force = false): Promise<string> {
    const existing = word.transcription?.trim();
    if (existing && !force) return existing;
    const ipa = await resolve(AiModel).prompt(
        `Return only the IPA phonetic transcription (in the standard /…/ form, no extra words) for the English word: "${word.word}".`
    );
    const transcription = (ipa ?? '').trim();
    if (transcription) await resolve(WordsDatabase).setTranscription(word.id, transcription);
    return transcription;
}

async function ensureExample(word: Word, force = false): Promise<string> {
    const existing = word.example?.trim();
    if (existing && !force) return existing;
    const meaningClause = word.description?.trim()
        ? ` in the sense of "${word.description.trim()}"`
        : '';
    const sentence = await resolve(AiModel).prompt(
        `Write one short, natural example sentence using the English word "${word.word}"${meaningClause}. Avoid military or depressive themes. Return only the sentence.`
    );
    const example = (sentence ?? '').trim();
    if (example) await resolve(WordsDatabase).setExample(word.id, example);
    return example;
}

async function ensureImage(word: Word, force = false): Promise<Buffer | undefined> {
    if (word.image && !force) return Buffer.from(word.image);
    const example = await ensureExample(word, force);
    const prompt = `Image in rubberhouse style but #f68201-#209dba desaturated gamma, like pastel or Anderson films, ${example}`;
    const image = await resolve(Imagen).generate(prompt);
    if (image) await resolve(WordsDatabase).setImage(word.id, image);
    return image;
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
    if (!parsed) return false;
    const {keyword, force} = parsed;
    const word = await resolveWord(e);
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
            const image = await ensureImage(word, force);
            const example = word.example?.trim() || '';
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
    }
    return false;
}
