import {TelegrafApi} from "../telegraf.api";
import {IncomingMessageEvent} from "../../messengers/messenger";
import {resolve} from "@cmmn/core";
import {WordsDatabase} from "../../db/wordsDatabase";

export async function word(this: TelegrafApi, ctx: IncomingMessageEvent) {
    const wordDb = resolve(WordsDatabase);
    const message = await ctx.text();
    const word = message.text.substring('/word '.length);
    if (!word)
        return ctx.reply(`Provide a word: \`/word book\``);
    const res = await wordDb.getWord(word);
    if (!res)
        return ctx.reply(`Word ${word} is not found in database`);
    return ctx.reply(`Word: ${res.word}\nLevel: ${res.level}\nFrequence: ${res.frequency}\nDescr: ${res.description}`);
}