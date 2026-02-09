import {resolve} from "@di";
import {AiModel} from "../../services/ai-model";
import {IncomingMessageEvent, Messenger} from "../../messengers/messenger";
import {TelegrafApi} from "../telegraf.api";


export async function ai(this: TelegrafApi, ctx: IncomingMessageEvent) {
    const message = await ctx.text();
    if (!message) return;
    const [cmd, level, ...text] = message.text.split(' ');
    const ai = resolve(AiModel);
    const prompt = `Generate 1 phrase with '${text.join(' ')}' at an ${level} English level. Output phrase only.`;
    const textResponse = await ai.prompt(prompt);
    return ctx.reply({
        type: 'text',
        text: textResponse ?? `Write /ai {level} {text}`
    });
}