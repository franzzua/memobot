import {singleton} from "@cmmn/core";
import {VertexAI} from "@google-cloud/vertexai";
import {readFileSync} from "node:fs";
import {gcsConfig} from "../db/gcs.config";

const MODEL = 'gemini-2.5-flash-image';
const MASCOT_PATH = './assets/parrot.jpeg';
const MASCOT_INSTRUCTION = "Include exactly one small blue parrot. Treat the attached image as a character reference only, never as an image asset. Redraw the mascot from scratch, preserving its visual identity (blue body, yellow eye, black beak, silhouette and expression) while adapting everything else to the generated artwork. The parrot must inherit the scene's rendering style, lighting, perspective, textures and detail, appearing as if created by the same artist. Integrate it naturally as a subtle easter egg, never looking pasted, traced, composited or stylistically inconsistent.";

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
