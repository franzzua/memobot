import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {WordSendHandlers} from "../../services/word-send-handlers";
import {resolveWord} from "./wordReply";
import {resolve} from "@cmmn/core";
import {WordsDatabase} from "../../db/wordsDatabase";

// Sends all steps of a word at once (flashcard, voice, missing word, word quiz, SAT), to
// try the flow without waiting for the plan. The word is the one replied to, or else the
// last one sent; `/steps <word>` picks any word.
export async function steps(this: TelegrafApi, ctx: IncomingMessageEvent) {
    const text = (await ctx.text())?.text ?? '';
    const requested = text.split(/\s+/).slice(1).join(' ').trim();
    const word = requested
        ? await resolve(WordsDatabase).getWord(requested)
        : await resolveWord(ctx);
    if (!word) {
        return ctx.reply(requested ? `No word "${requested}"` : 'No word yet: reply to a word or use /steps <word>');
    }
    const chatId = ctx.chat.toString();
    const message = {
        id: `word.${word.id}`, content: word.word, details: word.description ?? '',
        createdAt: new Date(), number: 0, deleted: false, kind: 'word' as const, refId: word.id,
    };
    for (let step = 0; step <= WordSendHandlers.length; step++) {
        await this.sendWordStep(chatId, word, step, message, step < WordSendHandlers.length);
    }
}
