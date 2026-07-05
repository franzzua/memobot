import {singleton} from "@cmmn/core";
import {VertexAI} from "@google-cloud/vertexai";
import {readFileSync} from "node:fs";
import {gcsConfig} from "../db/gcs.config";

const MODEL = 'gemini-2.5-flash-image';
const MASCOT_PATH = './assets/parrot.jpeg';
const MASCOT_INSTRUCTION = 'Also include the attached blue parrot mascot somewhere in the scene, small and unobtrusive, fitting naturally into the composition and art style.';

@singleton()
export class Imagen {
    private client = new VertexAI({project: gcsConfig.projectId}).getGenerativeModel({model: MODEL});
    private mascot = readFileSync(MASCOT_PATH).toString('base64');

    async generate(prompt: string): Promise<Buffer | undefined> {
        try {
            const resp = await this.client.generateContent({
                contents: [{
                    role: 'user',
                    parts: [
                        {text: `${prompt}\n\n${MASCOT_INSTRUCTION}`},
                        {inlineData: {mimeType: 'image/jpeg', data: this.mascot}},
                    ],
                }],
            });
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
