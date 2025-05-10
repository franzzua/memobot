import {singleton} from "@di";
import {auth} from "google-auth-library";
import {GenerativeModel, VertexAI} from "@google-cloud/vertexai";

@singleton()
export class AiModel {
    private model: GenerativeModel | undefined;
    private async getModel(){
        const projectId = await auth.getProjectId();
        const vertexAI = new VertexAI({
            project: projectId!
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