import textToSpeech from "@google-cloud/text-to-speech";
import {singleton} from "@cmmn/core";
import {gcsConfig} from "../db/gcs.config";

@singleton()
export class TextToSpeech{
    private client = new textToSpeech.TextToSpeechClient({projectId: gcsConfig.projectId});
    async getStream(text: string, type: 'mp3' | 'ogg_opus'){

        const [response] = await this.client.synthesizeSpeech({
            input: { text },
            voice: {languageCode: 'en-US', ssmlGender: 'FEMALE', name: 'en-US-Journey-F'},
            audioConfig: {audioEncoding: type.toLocaleUpperCase() as any },
        });
        if (response.audioContent instanceof Uint8Array) {
            return Buffer.from(response.audioContent);
        } else {
            throw  response.audioContent;
            // return Buffer.from(response.audioContent);

        }
    }
}