import type {TaskSendHandler} from "./index";
import {resolve} from "@di";
import {AiModel} from "../ai-model";

export const ai: TaskSendHandler = async function aiHandler(task) {
    const ai = resolve(AiModel);
    return await ai.prompt(`
        Generate short phrase containing ${task.content}.
        Return only this phrase without additional text       
    `);
}


