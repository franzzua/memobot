import {TelegrafApi} from "../telegraf.api";
import {AudioMessage, IncomingMessageEvent} from "../../messengers/messenger";
import {resolve} from "@cmmn/core";
import {WordsDatabase} from "../../db/wordsDatabase";
import {TextToSpeech} from "../../services/text-to-speech";
import {AiModel} from "../../services/ai-model";

const KEYWORDS = ['voice', 'trans', 'example'] as const;
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

export async function tryHandleWordReply(this: TelegrafApi, e: IncomingMessageEvent): Promise<boolean> {
    if (!e.replyTo?.isBot || !e.replyTo.text) return false;
    const text = (await e.text())?.text;
    if (!text) return false;
    const keyword = text.trim().toLowerCase();
    if (!isKeyword(keyword)) return false;
    const candidate = extractWord(e.replyTo.text);
    if (!candidate) return false;
    const word = await resolve(WordsDatabase).getWord(candidate);
    if (!word) return false;
    const wordsDb = resolve(WordsDatabase);
    switch (keyword) {
        case 'voice': {
            let audio: Buffer | undefined = word.voice ? Buffer.from(word.voice) : undefined;
            if (!audio) {
                audio = await resolve(TextToSpeech).getStream(word.word, 'ogg_opus');
                await wordsDb.setVoice(word.id, audio);
            }
            await e.reply({type: 'audio', audio, audioType: 'ogg'} as AudioMessage, {replyTo: e.id});
            return true;
        }
        case 'trans': {
            let transcription = word.transcription?.trim();
            if (!transcription) {
                const ipa = await resolve(AiModel).prompt(
                    `Return only the IPA phonetic transcription (in the standard /…/ form, no extra words) for the English word: "${word.word}".`
                );
                transcription = (ipa ?? '').trim();
                if (transcription) await wordsDb.setTranscription(word.id, transcription);
            }
            await e.reply(transcription || `Cannot transcribe ${word.word}`, {replyTo: e.id});
            return true;
        }
        case 'example': {
            const sentence = await resolve(AiModel).prompt(
                `Write one short, natural example sentence using the English word "${word.word}". Return only the sentence.`
            );
            await e.reply((sentence ?? '').trim() || `Cannot create example for ${word.word}`, {replyTo: e.id});
            return true;
        }
    }
    return false;
}
