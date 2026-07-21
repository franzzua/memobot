import {singleton} from "@cmmn/core";
import {VertexAI} from "@google-cloud/vertexai";
import {readFileSync} from "node:fs";
import {gcsConfig} from "../db/gcs.config";

const MODEL = 'gemini-2.5-flash-image';
const MASCOT_PATH = './assets/parrot.jpeg';
const MASCOT_INSTRUCTION = "Hide exactly one small blue parrot within the environment as a subtle visual easter egg, not a subject. Use the attached image only to preserve the mascot's identity, then regenerate it entirely in the scene's artistic style. Match the rendering, proportions, palette, lighting, textures, line quality and detail of nearby objects so it is visually indistinguishable from the rest of the artwork. Give it the same visual importance as an ordinary background prop or decoration. It should be discovered only after careful observation, never appearing iconic, pasted, logo-like, composited or stylistically distinct.";

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
