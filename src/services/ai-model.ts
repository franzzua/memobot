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
            model: 'gemini-2.0-flash',
        });
    }

    async prompt(prompt: string){
        this.model ??= await this.getModel();
        const resp = await this.model.generateContent(prompt);
        return resp.response.candidates?.[0].content?.parts?.[0].text;
    }

}