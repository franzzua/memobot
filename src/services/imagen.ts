import {singleton} from "@cmmn/core";
import {VertexAI} from "@google-cloud/vertexai";
import {readFileSync} from "node:fs";
import {gcsConfig} from "../db/gcs.config";

const MODEL = 'gemini-2.5-flash-image';
const MASCOT_PATH = './assets/parrot.jpeg';
const MASCOT_INSTRUCTION = 'Also, seamlessly integrate an image of a parrot that is based on the attached image of the blue parrot mascot into the scene that illustrates the word corresponding to the resulted image, making it fit the visual context naturally in terms of the composition and the style. Totally avoid simply inserting the source image and generate an image that just adds the visual that merely resembles it. It may be located anywhere where it makes sense based on the provided context, and it’s only a tiny detail that’s kinda hard to notice at first glance. ';

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
