import {TelegrafApi} from "../telegraf.api";
import {resolve} from "@di";
import {TextToSpeech} from "../../services/text-to-speech";
import {AiModel} from "../../services/ai-model";
import {IncomingMessageEvent} from "../../messengers/messenger";

export async function voice(this: TelegrafApi, ctx: IncomingMessageEvent){
    const message = await ctx.text();
    if (!message) return;
    const [cmd, ...text] = message.text.split(' ');
    if (!text)
        return ctx.reply(`format: /voice %something%`)
    const tts = resolve(TextToSpeech);
    const ai = resolve(AiModel);
    try {
        const description = await ai.prompt(`Describe '${text.join(' ')}' with 10-20 words`)
        const stream = await tts.getStream(description ?? text.join(' '), 'ogg_opus');
        return ctx.reply({
            type: 'audio',
            audio: stream,
            audioType: 'ogg'
        })
    }catch (error){
        console.error(error);
        return ctx.reply(`format: /voice %something%`)
    }
}