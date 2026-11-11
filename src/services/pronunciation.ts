import {singleton} from "@cmmn/core";

// Pronunciation scoring by our own Cloud Run service (services/pronunciation): a wav2vec2
// model that recognises IPA phonemes, scored against espeak-ng's expected phonemes.
// Telegram voice messages (ogg/opus) are sent as is.
//
// Needs PRONUNCIATION_URL. The service is private; on GCP the identity token comes from
// the metadata server, so the function's service account needs roles/run.invoker on it.

export type PronunciationResult = {
    // Expected phonemes, space separated (e.g. "k ʌ m f t ə b ə l").
    expected: string;
    // What the model heard, with no knowledge of the expected text.
    heard: string;
    score: number;
    phonemes: Array<{
        phoneme: string;
        score: number;
        // What it sounded like, when the expected phoneme scored under 50.
        instead: string | null;
    }>;
};

@singleton()
export class Pronunciation {
    private get url(): string | undefined {
        return process.env.PRONUNCIATION_URL?.replace(/\/$/, '');
    }

    get isConfigured(): boolean {
        return !!this.url;
    }

    async assess(audio: Buffer, referenceText: string): Promise<PronunciationResult> {
        const url = this.url;
        if (!url) throw new Error('PRONUNCIATION_URL is not set');
        const response = await fetch(`${url}/score?text=${encodeURIComponent(referenceText)}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${await identityToken(url)}`,
                'Content-Type': 'application/octet-stream',
            },
            body: new Uint8Array(audio),
        });
        if (!response.ok) {
            throw new Error(`pronunciation service returned ${response.status}: ${await response.text()}`);
        }
        return response.json();
    }
}

// Identity token for calling a private Cloud Run service, from the GCP metadata server.
// Tokens live an hour; reuse one for 50 minutes.
let cachedToken: {audience: string; token: string; expires: number} | undefined;

async function identityToken(audience: string): Promise<string> {
    if (cachedToken && cachedToken.audience === audience && cachedToken.expires > Date.now()) {
        return cachedToken.token;
    }
    const response = await fetch(
        `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`,
        {headers: {'Metadata-Flavor': 'Google'}},
    );
    if (!response.ok) throw new Error(`metadata server returned ${response.status}`);
    const token = await response.text();
    cachedToken = {audience, token, expires: Date.now() + 50 * 60 * 1000};
    return token;
}

// Calibrated on synthetic speech only: a correctly said word scored ~78-89, one with two
// wrong sounds ~57, a different word ~33-40. Revisit with real recordings.
const EXCELLENT = 75;
const GOOD = 60;
// A phoneme under this is highlighted as a mistake (the service fills `instead` below it).
const WEAK_PHONEME = 50;

export function formatPronunciation(word: string, r: PronunciationResult): string {
    const verdict = r.score >= EXCELLENT ? '🟢 Excellent' : r.score >= GOOD ? '🟡 Good' : '🟠 May be better';
    // Runs of weak phonemes share one highlight.
    const transcription = r.phonemes
        .map((p, i) => {
            const weak = (q?: {score: number}) => !!q && q.score < WEAK_PHONEME;
            const open = weak(p) && !weak(r.phonemes[i - 1]) ? '<b><u>' : '';
            const close = weak(p) && !weak(r.phonemes[i + 1]) ? '</u></b>' : '';
            return open + p.phoneme + close;
        })
        .join('');
    const lines = [`🎙 <b>${word}</b>: ${verdict}`];
    if (transcription) lines.push(`/${transcription}/`);
    const swaps = r.phonemes
        .filter(p => p.score < WEAK_PHONEME && p.instead)
        .map(p => `/${p.phoneme}/ → /${p.instead}/`);
    if (swaps.length > 0) lines.push(`<i>sounded like ${swaps.join(', ')}</i>`);
    return lines.join('\n');
}
