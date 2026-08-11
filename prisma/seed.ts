import {PrismaClient, prismaFactory} from './client'
import quizData from "../sat_tests.json" with {type: "json"};
import nlp from 'compromise';
import {AiModel} from "../src/services/ai-model";
import {posPrompt, POS_VALUES} from "../src/services/prompts";
const prisma = prismaFactory()

function getInflectedForms(word: string): RegExp {
    const forms = new Set([word.toLowerCase()])
    const doc = nlp(word)

    const conjugated = doc.verbs().conjugate()[0]
    if (conjugated) {
        Object.values(conjugated).forEach(f => f && forms.add((f as string).toLowerCase()))
    }

    const plural = doc.nouns().toPlural().text()
    if (plural) forms.add(plural.toLowerCase())

    const pattern = [...forms]
        .map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|')
    return new RegExp(`\\b(${pattern})\\b`, 'i')
}

// Single-flight: the boot-time fire-and-forget call and the admin /api/seed
// endpoint must not run the chain concurrently (it doubles peak memory).
let running: Promise<void> | null = null;
export function seedData(): Promise<void> {
    return running ??= runSeedData().finally(() => { running = null; });
}

async function runSeedData() {
    await dedupeWords();
    await seedQuiz();
    await seedSatFrequency();
    await seedPos();
    await seedEmbeddings();
}

// The word list was imported with occasional duplicates (same word, paraphrased
// description). Keep one copy per word — preferring one that scheduled messages
// reference (already introduced to a learner) — and delete the rest, also pulling
// deleted ids out of plan wordOrders. That array edit is safe: words are introduced
// strictly in order, so an id with no word-message sits at an index the plan cursor
// has not reached yet, and removing it never shifts already-introduced positions.
// If several copies were already introduced, all of those are kept.
export async function dedupeWords() {
    const words = await prisma.word.findMany({select: {id: true, word: true}, orderBy: {id: 'asc'}});
    const groups = new Map<string, string[]>();
    for (const w of words) {
        const key = w.word.trim().toUpperCase();
        groups.set(key, [...(groups.get(key) ?? []), w.id]);
    }
    const dupGroups = [...groups.values()].filter(ids => ids.length > 1);
    if (dupGroups.length === 0) return;

    const dupIds = dupGroups.flat();
    const introduced = new Set<string>();
    for (const m of await prisma.message.findMany({where: {refId: {in: dupIds}}, select: {refId: true}})) {
        if (m.refId) introduced.add(m.refId);
    }

    const remove = new Set<string>();
    for (const ids of dupGroups) {
        const keep = ids.find(id => introduced.has(id)) ?? ids[0];
        for (const id of ids) {
            if (id !== keep && !introduced.has(id)) remove.add(id);
        }
    }
    if (remove.size === 0) return;

    const chats = await prisma.chat.findMany({select: {id: true, wordOrder: true}});
    for (const c of chats) {
        if (!c.wordOrder.some(id => remove.has(id))) continue;
        await prisma.chat.update({
            where: {id: c.id},
            data: {wordOrder: c.wordOrder.filter(id => !remove.has(id))},
        });
    }
    await prisma.word.deleteMany({where: {id: {in: [...remove]}}});
}

// Backfill of Word.embedding: a MiniLM sentence vector of "word: description" (the
// description pins the taught meaning). Vectors are precomputed offline by
// `yarn embeddings` (scripts/compute-embeddings.ts) into word-embeddings.json —
// running the @xenova/transformers ONNX model live in this Cloud Function OOMs the
// 1GiB instance, so this only ever applies already-computed vectors. Words missing
// from the fixture are left null; rerun `yarn embeddings` to pick them up.
export async function seedEmbeddings() {
    const rows = await prisma.word.findMany({select: {id: true, word: true, description: true, embedding: true}});
    const missing = rows.filter(w => !w.embedding);
    if (missing.length === 0) return;

    const fixture = (await import('./word-embeddings.json', {with: {type: 'json'}})).default as Record<string, number[]>;
    let unmatched = 0;
    for (const w of missing) {
        const key = w.description?.trim() ? `${w.word}: ${w.description.trim()}` : w.word;
        const embedding = fixture[key];
        if (!embedding) { unmatched++; continue; }
        await prisma.word.update({where: {id: w.id}, data: {embedding}});
    }
    if (unmatched > 0) console.warn(`seedEmbeddings: ${unmatched} word(s) missing from word-embeddings.json — run 'yarn embeddings'`);
}

// One-time AI backfill of Word.type (part of speech), pinned to each word's taught
// meaning via its description. Only rows still null are processed, so it is a no-op
// once filled and picks up any words added later without a type.
export async function seedPos() {
    // select omits the Bytes columns (voice/image) — see seedSatFrequency.
    const words = await prisma.word.findMany({ where: { type: null }, select: { id: true, word: true, description: true } });
    if (words.length === 0) return;

    const ai = new AiModel();
    const valid = new Set<string>(POS_VALUES);
    const chunkSize = 4;
    for (let i = 0; i < words.length; i += chunkSize) {
        await Promise.all(words.slice(i, i + chunkSize).map(async (w) => {
            const raw = await promptWithRetry(ai, posPrompt(w.word, w.description));
            const pos = raw?.trim().toLowerCase().replace(/[^a-z]/g, '');
            if (pos && valid.has(pos)) {
                await prisma.word.update({ where: { id: w.id }, data: { type: pos } });
            }
        }));
    }
}

// Vertex throttles bursts with 429 RESOURCE_EXHAUSTED; back off and retry before
// giving up on a word (a skipped word stays null and is retried on the next start).
async function promptWithRetry(ai: AiModel, prompt: string, attempts = 4): Promise<string | null> {
    for (let i = 0; i < attempts; i++) {
        try {
            return await ai.prompt(prompt) ?? null;
        } catch {
            if (i < attempts - 1) await new Promise(r => setTimeout(r, 5000 * 2 ** i));
        }
    }
    return null;
}

export async function seedSatFrequency() {
    const computed = await prisma.word.count({ where: { satFrequency: null } });
    if (computed == 0) return;

    // Never fetch full rows here: Word.voice/image and Quiz.attachment are large
    // Bytes columns, and loading all of them at once OOMs the 1GiB instance.
    const words = await prisma.word.findMany({ where: { satFrequency: null }, select: { id: true, word: true } });
    const quizzes = await prisma.quiz.findMany({ select: { question: true, answers: true } });

    await Promise.all(words.map(async (w) => {
        const re = getInflectedForms(w.word);
        let score = 0;

        for (const quiz of quizzes) {
            if (re.test(quiz.question)) score += 1;
            for (const answer of (quiz.answers as string[])) {
                if (re.test(answer)) score += 2;
            }
        }

        await prisma.word.update({ where: { id: w.id }, data: { satFrequency: score } });
    }));
}

export async function seedQuiz() {
    if ((await prisma.quiz.count()) > 0)
        return;
    return prisma.quiz.createMany({
        data: quizData.map(q => {
            return {
                question: q.question,
                answers: q.options,
                correct: q.correct,
                table_md: q.addition,
                attachment: q.image
                    ? Buffer.from(q.image.split(',')[1], 'base64')
                    : null,
                index: q.index
            };
        }),
        skipDuplicates: true, // Optional
    })
}
