import {TelegrafApi} from "../telegraf.api";
import {AudioMessage, IncomingMessageEvent} from "../../messengers/messenger";
import {resolve} from "@cmmn/core";
import {WordsDatabase} from "../../db/wordsDatabase";
import {TextToSpeech} from "../../services/text-to-speech";
import {AiModel} from "../../services/ai-model";
import {PrismaSchedulerStorage} from "../../db/prismaSchedulerStorage";
import {TaskScheduler} from "../../db/task.scheduler";
import type {Word} from "../../../prisma/client";

const KEYWORDS = ['voice', 'example', 'skip'] as const;
type Keyword = typeof KEYWORDS[number];

function isKeyword(value: string): value is Keyword {
    return (KEYWORDS as readonly string[]).includes(value);
}

function extractWord(botText: string): string | undefined {
    const firstLine = botText.split('\n')[0]?.trim();
    if (!firstLine) return undefined;
    const stripped = firstLine.replace(/^word\s*:\s*/i, '').trim();
    return stripped || undefined;
}

async function resolveWord(e: IncomingMessageEvent): Promise<Word | null> {
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

async function ensureTranscription(word: Word): Promise<string> {
    const existing = word.transcription?.trim();
    if (existing) return existing;
    const ipa = await resolve(AiModel).prompt(
        `Return only the IPA phonetic transcription (in the standard /…/ form, no extra words) for the English word: "${word.word}".`
    );
    const transcription = (ipa ?? '').trim();
    if (transcription) await resolve(WordsDatabase).setTranscription(word.id, transcription);
    return transcription;
}

async function ensureVoice(word: Word): Promise<Buffer> {
    if (word.voice) return Buffer.from(word.voice);
    const audio = await resolve(TextToSpeech).getStream(word.word, 'ogg_opus');
    await resolve(WordsDatabase).setVoice(word.id, audio);
    return audio;
}

export async function tryHandleWordReply(this: TelegrafApi, e: IncomingMessageEvent): Promise<boolean> {
    const text = (await e.text())?.text;
    if (!text) return false;
    const keyword = text.trim().toLowerCase();
    if (!isKeyword(keyword)) return false;
    const word = await resolveWord(e);
    if (!word) return false;
    switch (keyword) {
        case 'voice': {
            const [audio, transcription] = await Promise.all([
                ensureVoice(word),
                ensureTranscription(word),
            ]);
            await e.reply({
                type: 'audio',
                audio,
                audioType: 'ogg',
                caption: transcription || undefined,
            } as AudioMessage, {replyTo: e.id});
            return true;
        }
        case 'example': {
            const sentence = await resolve(AiModel).prompt(
                `Write one short, natural example sentence using the English word "${word.word}". Return only the sentence.`
            );
            await e.reply((sentence ?? '').trim() || `Cannot create example for ${word.word}`, {replyTo: e.id});
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
