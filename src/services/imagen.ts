import {singleton} from "@cmmn/core";
import {auth} from "google-auth-library";

const MODEL = 'imagen-4.0-generate-001';
const DEFAULT_LOCATIONS = [
    'us-central1', 'us-east1', 'us-east4', 'us-east5', 'us-south1', 'us-west1', 'us-west4',
    'europe-west1', 'europe-west2', 'europe-west3', 'europe-west4',
    'europe-west6', 'europe-west8', 'europe-west9',
    'me-central1', 'me-central2', 'me-west1',
    'asia-northeast1', 'asia-northeast3', 'asia-southeast1',
];
const LOCATIONS = (process.env.IMAGEN_LOCATIONS?.split(',').map(s => s.trim()).filter(Boolean)) ?? DEFAULT_LOCATIONS;
const pickLocation = () => LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

type PredictResponse = {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
};

@singleton()
export class Imagen {
    private projectId: string | undefined;

    async generate(prompt: string): Promise<Buffer | undefined> {
        this.projectId ??= await auth.getProjectId();
        const client = await auth.getClient();
        const location = pickLocation();
        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${location}/publishers/google/models/${MODEL}:predict`;
        const res = await client.request<PredictResponse>({
            url,
            method: 'POST',
            data: {
                instances: [{prompt}],
                parameters: {sampleCount: 1, aspectRatio: '1:1'},
            },
        });
        const b64 = res.data?.predictions?.[0]?.bytesBase64Encoded;
        if (!b64) return undefined;
        return Buffer.from(b64, 'base64');
    }
}
