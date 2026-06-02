import textToSpeech from "@google-cloud/text-to-speech";
import {singleton} from "@cmmn/core";
import {gcsConfig} from "../db/gcs.config";

@singleton()
export class TextToSpeech{
    private client = new textToSpeech.TextToSpeechClient({projectId: gcsConfig.projectId});
    async getStream(text: string, type: 'mp3' | 'ogg_opus', ipa?: string){
        const input = ipa
            ? { ssml: `<speak><phoneme alphabet="ipa" ph="${ipa.replace(/^\/|\/$/g, '')}">${text}</phoneme></speak>` }
            : { text };
        const [response] = await this.client.synthesizeSpeech({
            input,
            voice: {languageCode: 'en-US', ssmlGender: 'FEMALE', name: 'en-US-Journey-F'},
            audioConfig: {audioEncoding: type.toLocaleUpperCase() as any, speakingRate: 0.85 },
        });
        if (response.audioContent instanceof Uint8Array) {
            return Buffer.from(response.audioContent);
        } else {
            throw  response.audioContent;
            // return Buffer.from(response.audioContent);

        }
    }
}