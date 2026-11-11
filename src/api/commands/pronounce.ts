import {TelegrafApi} from "../telegraf.api";
import {resolve} from "@cmmn/core";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {Pronunciation, formatPronunciation} from "../../services/pronunciation";
import {resolveWord} from "./wordReply";

// A voice message is scored against the word it replies to, or else the last word sent.
export async function onVoiceMessage(this: TelegrafApi, e: IncomingMessageEvent) {
    const pronunciation = resolve(Pronunciation);
    if (!pronunciation.isConfigured) return;
    const audio = await e.audio();
    if (!audio) return;
    const word = await resolveWord(e);
    if (!word) return;
    try {
        const result = await pronunciation.assess(audio.audio, word.word);
        return e.reply(formatPronunciation(word.word, result), {replyTo: e.id});
    } catch (error) {
        console.error('[pronounce]', error);
    }
}
