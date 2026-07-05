import textToSpeech from "@google-cloud/text-to-speech";
import {singleton} from "@cmmn/core";
import {gcsConfig} from "../db/gcs.config";

@singleton()
export class TextToSpeech{
    private client = new textToSpeech.TextToSpeechClient({projectId: gcsConfig.projectId});
    async getStream(text: string, type: 'mp3' | 'ogg_opus', ipa?: string, example?: string){
        const wordSegment = ipa
            ? `<phoneme alphabet="ipa" ph="${ipa.replace(/^\/|\/$/g, '')}">${this.escapeXml(text)}</phoneme>`
            : this.escapeXml(text);
        const input = example
            ? { ssml: `<speak>${wordSegment}<break time="1000ms"/>${this.escapeXml(example)}</speak>` }
            : ipa
                ? { ssml: `<speak>${wordSegment}</speak>` }
                : { text };
        const [response] = await this.client.synthesizeSpeech({
            input,
            voice: {languageCode: 'en-US', name: 'en-US-Chirp3-HD-Fenrir'},
            audioConfig: {audioEncoding: type.toLocaleUpperCase() as any, speakingRate: 0.9 },
        }).catch(async () => {
            const [fallback] = await this.client.synthesizeSpeech({
                input: {text: example ? `${text}. ${example}` : text},
                voice: {languageCode: 'en-US', name: 'en-US-Chirp3-HD-Fenrir'},
                audioConfig: {audioEncoding: type.toLocaleUpperCase() as any, speakingRate: 0.9 },
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