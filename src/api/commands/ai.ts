import { CommandContext } from "../types";
import { VertexAI } from '@google-cloud/vertexai';
import {auth} from "google-auth-library";
import { TelegrafApi } from "../telegraf.api";
import {resolve} from "@di";
import {AiModel} from "../../services/ai-model";
async function getModel(){
    const projectId = await auth.getProjectId();
    const vertexAI = new VertexAI({
        project: projectId!
    });
    return vertexAI.getGenerativeModel({
        model: 'gemini-1.5-flash-001',
    });   
}
export async function ai(this: TelegrafApi, ctx: CommandContext){
    const [cmd, level, ...text] = ctx.message.text.split(' ');
    const ai = resolve(AiModel);
    const prompt = `Generate 1 phrase with '${text.join(' ')}' at an ${level} English level. Output phrase only.`;
    const textResponse = await ai.prompt(prompt);
    return ctx.reply(textResponse ?? `Write /ai {level} {text}`);
}