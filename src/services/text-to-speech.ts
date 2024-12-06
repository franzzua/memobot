import textToSpeech from "@google-cloud/text-to-speech";
import {singleton} from "@di";

@singleton()
export class TextToSpeech{
    private client = new textToSpeech.TextToSpeechClient();
    async getStream(text: string){

        const [response] = await this.client.synthesizeSpeech({
            input: { text },
            voice: {languageCode: 'en-US', ssmlGender: 'FEMALE', name: 'en-US-Journey-F'},
            audioConfig: {audioEncoding: 'MP3'},
        });
        if (response.audioContent instanceof Uint8Array) {
            return Buffer.from(response.audioContent);
        } else {
            throw  response.audioContent;
            // return Buffer.from(response.audioContent);

        }
    }
}