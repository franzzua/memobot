import {singleton} from "@cmmn/core";
import {auth} from "google-auth-library";
import {gcsConfig} from "../db/gcs.config";

const MODEL = 'imagen-4.0-generate-001';
const DEFAULT_LOCATIONS = [
    'us-central1', 'us-east4', 'us-west1',
    'europe-west1', 'europe-west4',
];
const LOCATIONS = (process.env.IMAGEN_LOCATIONS?.split(',').map(s => s.trim()).filter(Boolean)) ?? DEFAULT_LOCATIONS;
const pickLocation = () => LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

type PredictResponse = {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
};

@singleton()
export class Imagen {
    async generate(prompt: string): Promise<Buffer | undefined> {
        try {
            const client = await auth.getClient();
            const location = pickLocation();
            const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${gcsConfig.projectId}/locations/${location}/publishers/google/models/${MODEL}:predict`;
            const res = await client.request<PredictResponse>({
                url,
                method: 'POST',
                data: {
                    instances: [{prompt}],
                    parameters: {sampleCount: 1, aspectRatio: '1:1'},
                },
                timeout: 120000,
            });
            const b64 = res.data?.predictions?.[0]?.bytesBase64Encoded;
            if (!b64) return undefined;
            return Buffer.from(b64, 'base64');
        } catch (e) {
            console.error('Imagen generate error:', e);
            return undefined;
        }
    }
}
