import {TelegrafApi} from "../telegraf.api";
import {resolve} from "@di";
import {TextToSpeech} from "../../services/text-to-speech";
import {CommandContext} from "../types";
import {AiModel} from "../../services/ai-model";

export async function voice(this: TelegrafApi, ctx: CommandContext){
    const [cmd, ...text] = ctx.message!.text.split(' ');
    if (!text)
        return ctx.reply(`format: /voice %something%`)
    const tts = resolve(TextToSpeech);
    const ai = resolve(AiModel);
    try {
        const description = await ai.prompt(`Describe '${text.join(' ')}' with 10-20 words`)
        const stream = await tts.getStream(description ?? text.join(' '));
        return ctx.replyWithVoice({
            source: stream,
        }, {

        })
    }catch (error){
        console.error(error);
        return ctx.reply(`format: /voice %something%`)
    }
}