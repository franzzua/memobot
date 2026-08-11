import {singleton} from "@cmmn/core";
import {GenerativeModel, VertexAI} from "@google-cloud/vertexai";
import {gcsConfig} from "../db/gcs.config";

@singleton()
export class AiModel {
    private model: GenerativeModel | undefined;
    private async getModel(){
        const vertexAI = new VertexAI({
            project: gcsConfig.projectId,
        });
        return vertexAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
        });
    }

    async prompt(prompt: string, attempts = 4){
        this.model ??= await this.getModel();
        for (let i = 0; i < attempts; i++) {
            try {
                const resp = await this.model.generateContent(prompt);
                return resp.response.candidates?.[0].content?.parts?.[0].text;
            } catch (err: any) {
                // Vertex throttles bursts with 429 RESOURCE_EXHAUSTED; back off and retry
                // rather than failing the request outright.
                if (err?.code !== 429 || i === attempts - 1) throw err;
                await new Promise(r => setTimeout(r, 5000 * 2 ** i));
            }
        }
    }

}