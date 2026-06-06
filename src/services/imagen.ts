import {singleton} from "@cmmn/core";
import {VertexAI} from "@google-cloud/vertexai";
import {gcsConfig} from "../db/gcs.config";

const MODEL = 'gemini-2.5-flash-image';

@singleton()
export class Imagen {
    private client = new VertexAI({project: gcsConfig.projectId}).getGenerativeModel({model: MODEL});

    async generate(prompt: string): Promise<Buffer | undefined> {
        try {
            const resp = await this.client.generateContent(prompt);
            for (const part of resp.response.candidates?.[0]?.content?.parts ?? []) {
                if ('inlineData' in part && part.inlineData?.data) {
                    return Buffer.from(part.inlineData.data, 'base64');
                }
            }
            return undefined;
        } catch (e) {
            console.error('Imagen generate error:', e);
            return undefined;
        }
    }
}
