import textToSpeech from "@google-cloud/text-to-speech";
import {singleton} from "@cmmn/core";
import {gcsConfig} from "../db/gcs.config";

@singleton()
export class TextToSpeech{
    private client = new textToSpeech.TextToSpeechClient({projectId: gcsConfig.projectId});
    async getStream(text: string, type: 'mp3' | 'ogg_opus', ipa?: string){
        const input = ipa
            ? { ssml: `<speak><phoneme alphabet="ipa" ph="${this.escapeXml(ipa.replace(/^\/|\/$/g, ''))}">${this.escapeXml(text)}</phoneme></speak>` }
            : { text };
        const [response] = await this.client.synthesizeSpeech({
            input,
            voice: {languageCode: 'en-US', ssmlGender: 'FEMALE', name: 'en-US-Journey-F'},
            audioConfig: {audioEncoding: type.toLocaleUpperCase() as any, speakingRate: 0.85 },
        }).catch(async () => {
            const [fallback] = await this.client.synthesizeSpeech({
                input: {text},
                voice: {languageCode: 'en-US', ssmlGender: 'FEMALE', name: 'en-US-Journey-F'},
                audioConfig: {audioEncoding: type.toLocaleUpperCase() as any, speakingRate: 0.85 },
            });
            return [fallback];
        });
        if (response.audioContent instanceof Uint8Array) {
            return Buffer.from(response.audioContent);
        }
        throw response.audioContent;
    }

    private escapeXml(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}