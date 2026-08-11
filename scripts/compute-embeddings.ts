// Run locally (not in the Cloud Function) to precompute Word.embedding vectors.
// The @xenova/transformers ONNX model is what OOMs the 1GiB telegram-stage instance
// when seedEmbeddings() tries to compute it live for every existing word on first
// run. This script does that computation on a machine with headroom and writes the
// result to prisma/word-embeddings.json, which prisma/seed.ts applies to the DB
// without ever loading the model in production.
//
// Usage: yarn embeddings
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {prismaFactory} from '../prisma/client';

const prisma = prismaFactory();

const rows = await prisma.word.findMany({select: {word: true, description: true, embedding: true}});
console.log(`${rows.length} words in the DB`);

const fixturePath = fileURLToPath(import.meta.resolve('../prisma/word-embeddings.json'));
let fixture: Record<string, number[]> = {};
try {
    fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
} catch {
    // no existing fixture yet
}

// Rows already embedded in the DB (e.g. from a prior run) but not yet in the
// fixture just get copied in — no need to recompute what's already there.
const keyOf = (w: {word: string; description: string | null}) =>
    w.description?.trim() ? `${w.word}: ${w.description.trim()}` : w.word;
let synced = 0;
for (const w of rows) {
    const key = keyOf(w);
    if (w.embedding && !fixture[key]) {
        fixture[key] = w.embedding as number[];
        synced++;
    }
}
if (synced > 0) console.log(`Synced ${synced} already-computed vector(s) from the DB into the fixture.`);

const missing = rows.filter(w => !w.embedding && !fixture[keyOf(w)]);
if (missing.length === 0) {
    console.log('Nothing left to compute.');
} else {
    const {pipeline} = await import('@xenova/transformers');
    const embed = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    for (const w of missing) {
        const key = keyOf(w);
        const out = await embed(key, {pooling: 'mean', normalize: true});
        fixture[key] = Array.from(out.data as Float32Array);
        console.log(`computed: ${key}`);
    }
}

await writeFile(fixturePath, JSON.stringify(fixture, null, 0), 'utf8');
console.log(`Wrote ${Object.keys(fixture).length} vectors to ${fixturePath}`);
process.exit(0);
