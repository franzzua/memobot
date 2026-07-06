import {singleton} from "@cmmn/core";
import {VertexAI} from "@google-cloud/vertexai";
import {readFileSync} from "node:fs";
import {gcsConfig} from "../db/gcs.config";

const MODEL = 'gemini-2.5-flash-image';
const MASCOT_PATH = './assets/parrot.jpeg';
const MASCOT_INSTRUCTION = 'Include a small blue parrot in the scene. Use the attached image only as a character reference, not as artwork to insert or copy. Redraw the parrot from scratch so it preserves its recognizable identity (blue body, yellow eye, black beak, overall silhouette and expression) while fully matching the scene's style, lighting, perspective, colors, textures, and level of detail. It must look like it was created by the same artist as the rest of the image, not pasted from a separate asset. Keep it subtle and naturally placed within the environment.';

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
