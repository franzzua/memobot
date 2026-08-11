import {resolve} from "@cmmn/core";
import {PrismaClient, type Word} from "../../prisma/client";
import {WordsDatabase} from "../db/wordsDatabase";
import {ImageRender} from "../services/image-render";
import {TextToSpeech} from "../services/text-to-speech";
import {AiModel} from "../services/ai-model";
import {Imagen} from "../services/imagen";
import {generateSatQuiz} from "../services/sat-quiz-generator";
import {transcriptionPrompt, examplePrompt, imagePrompt} from "../services/prompts";
import {seedData} from "../../prisma/seed";
import {pickSimilarDistractors} from "../services/distractor-picker";
import {SrsPlanner} from "../services/srs-planner";
import type {ServerResponse} from "node:http";

export const ADMIN_PATH = '/very-strong-and-secure-html-page-bh-90210';

type Req = { path: string; method: string; query?: any; body?: any };
type Res = ServerResponse & { sendStatus?(code: number): void };

export function isAdminRequest(path: string): boolean {
    return path === ADMIN_PATH || path.startsWith(ADMIN_PATH + '/');
}

export async function handleAdminRequest(req: Req, res: Res): Promise<void> {
    const path = req.path;
    const method = (req.method ?? 'GET').toUpperCase();

    try {
        if (path === ADMIN_PATH || path === ADMIN_PATH + '/') {
            return sendHtml(res, adminHTML);
        }

        const apiPrefix = ADMIN_PATH + '/api';
        const apiPath = path.slice(apiPrefix.length);

        // POST /api/seed — run the startup seed chain (dedupe, POS, embeddings, …)
        // inside a request. The fire-and-forget call at boot gets no CPU once the
        // instance goes idle (gen2 throttles background work), so long backfills
        // only ever finish here, where the 1800s request timeout applies.
        if (method === 'POST' && apiPath === '/seed') {
            await seedData();
            return sendJson(res, {ok: true});
        }

        // GET /api/stats — coverage counts for backfilled columns (POS, embedding).
        if (method === 'GET' && apiPath === '/stats') {
            return sendJson(res, await getStats());
        }

        // GET /api/words
        if (method === 'GET' && apiPath === '/words') {
            const query = typeof req.query === 'string'
                ? Object.fromEntries(new URLSearchParams(req.query).entries())
                : (req.query ?? {});
            return sendJson(res, await getWords(query));
        }

        // GET /api/words/:id/image
        const imageMatch = apiPath.match(/^\/words\/([^/]+)\/image$/);
        if (method === 'GET' && imageMatch) {
            return await getWordImage(res, imageMatch[1]);
        }

        // GET /api/words/:id/flashcard
        const flashcardMatch = apiPath.match(/^\/words\/([^/]+)\/flashcard$/);
        if (method === 'GET' && flashcardMatch) {
            return await getWordFlashcard(res, flashcardMatch[1]);
        }

        // GET /api/words/:id/voice
        const voiceMatch = apiPath.match(/^\/words\/([^/]+)\/voice$/);
        if (method === 'GET' && voiceMatch) {
            return await getWordVoice(res, voiceMatch[1]);
        }

        // POST /api/words/:id/regenerate/voice
        const regenVoiceMatch = apiPath.match(/^\/words\/([^/]+)\/regenerate\/voice$/);
        if (method === 'POST' && regenVoiceMatch) {
            return sendJson(res, await regenerateVoice(regenVoiceMatch[1]));
        }

        // POST /api/words/:id/regenerate/example
        const regenExampleMatch = apiPath.match(/^\/words\/([^/]+)\/regenerate\/example$/);
        if (method === 'POST' && regenExampleMatch) {
            return sendJson(res, await regenerateExample(regenExampleMatch[1]));
        }

        // POST /api/words/:id/regenerate/image
        const regenImageMatch = apiPath.match(/^\/words\/([^/]+)\/regenerate\/image$/);
        if (method === 'POST' && regenImageMatch) {
            return sendJson(res, await regenerateImage(regenImageMatch[1]));
        }

        // POST /api/words/:id/regenerate/satquiz
        const regenSatQuizMatch = apiPath.match(/^\/words\/([^/]+)\/regenerate\/satquiz$/);
        if (method === 'POST' && regenSatQuizMatch) {
            return sendJson(res, await regenerateSatQuiz(regenSatQuizMatch[1]));
        }

        // GET /api/chats
        if (method === 'GET' && apiPath === '/chats') {
            const query = typeof req.query === 'string'
                ? Object.fromEntries(new URLSearchParams(req.query).entries())
                : (req.query ?? {});
            return sendJson(res, await getChats(query));
        }

        // GET /api/chats/:chatId/timetable
        const timetableMatch = apiPath.match(/^\/chats\/([^/]+)\/timetable$/);
        if (method === 'GET' && timetableMatch) {
            return sendJson(res, await getChatTimetable(decodeURIComponent(timetableMatch[1])));
        }

        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'not found'}));
    } catch (err: any) {
        console.error('Admin error:', err);
        if (!res.headersSent) {
            res.writeHead(500, {'Content-Type': 'application/json'});
        }
        if (!res.writableEnded) {
            res.end(JSON.stringify({error: err.message ?? 'internal error'}));
        }
    }
}

function sendJson(res: Res, data: any) {
    const body = JSON.stringify(data);
    res.writeHead(200, {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)});
    res.end(body);
}

function sendHtml(res: Res, html: string) {
    res.writeHead(200, {'Content-Type': 'text/html', 'Content-Length': Buffer.byteLength(html)});
    res.end(html);
}

function sendBuffer(res: Res, buf: Buffer, contentType: string) {
    res.writeHead(200, {'Content-Type': contentType, 'Content-Length': buf.length});
    res.end(buf);
}

// ---- handlers ----

async function getStats() {
    const prisma = resolve(PrismaClient);
    const [row] = await prisma.$queryRaw<{total: bigint; with_pos: bigint; with_embedding: bigint}[]>`
        SELECT count(*) AS total,
               count(*) FILTER (WHERE type IS NOT NULL) AS with_pos,
               count(*) FILTER (WHERE embedding IS NOT NULL) AS with_embedding
        FROM "Word"
    `;
    return {
        total: Number(row.total),
        withPos: Number(row.with_pos),
        withEmbedding: Number(row.with_embedding),
    };
}

async function getWords(query: Record<string, string>) {
    const prisma = resolve(PrismaClient);
    const take = 50;
    const skip = ((+(query.page ?? 1)) - 1) * take;
    const search = query.search;
    const where = search ? {word: {contains: search, mode: 'insensitive' as const}} : {};
    const [words, total] = await Promise.all([
        prisma.word.findMany({
            where, orderBy: {word: 'asc'}, take, skip,
            select: {id: true, word: true, description: true, type: true, level: true, frequency: true, transcription: true, example: true, satQuiz: true, voice: false, image: false}
        }),
        prisma.word.count({where})
    ]);
    const voiceCheck = await prisma.$queryRaw<{id: string; hv: boolean; hi: boolean}[]>`
        SELECT id, voice IS NOT NULL as hv, image IS NOT NULL as hi FROM "Word" WHERE id = ANY(${words.map(w => w.id)})
    `;
    const cacheMap = new Map(voiceCheck.map(r => [r.id, {hasVoice: r.hv, hasImage: r.hi}]));
    return {
        words: words.map(w => ({...w, hasVoice: cacheMap.get(w.id)?.hasVoice ?? false, hasImage: cacheMap.get(w.id)?.hasImage ?? false})),
        total,
        pages: Math.ceil(total / take)
    };
}

async function getWordImage(res: Res, id: string) {
    const prisma = resolve(PrismaClient);
    const word = await prisma.word.findUnique({where: {id}, select: {image: true}});
    if (word?.image) {
        return sendBuffer(res, Buffer.from(word.image), 'image/png');
    }
    res.writeHead(404, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error: 'no image'}));
}

async function getWordFlashcard(res: Res, id: string) {
    const prisma = resolve(PrismaClient);
    const word = await prisma.word.findUnique({where: {id}, select: {word: true, description: true}});
    if (!word) {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'not found'}));
        return;
    }
    const render = new ImageRender(word.word, word.description ?? '');
    const buf = render.render();
    sendBuffer(res, buf instanceof Buffer ? buf : Buffer.from(buf), 'image/png');
}

async function getWordVoice(res: Res, id: string) {
    const prisma = resolve(PrismaClient);
    const word = await prisma.word.findUnique({where: {id}, select: {voice: true}});
    if (word?.voice) {
        return sendBuffer(res, Buffer.from(word.voice), 'audio/ogg');
    }
    res.writeHead(404, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error: 'no voice'}));
}

async function regenerateVoice(id: string) {
    const wordsDb = resolve(WordsDatabase);
    const prisma = resolve(PrismaClient);
    const word = await prisma.word.findUnique({where: {id}, select: {word: true, description: true, transcription: true, example: true}});
    if (!word) return {error: 'not found'};
    const tts = resolve(TextToSpeech);
    const ai = resolve(AiModel);
    let transcription = word.transcription?.trim();
    if (!transcription) {
        const ipa = await ai.prompt(transcriptionPrompt(word.word));
        transcription = (ipa ?? '').trim();
        if (transcription) await wordsDb.setTranscription(id, transcription);
    }
    let example = word.example?.trim();
    if (!example) {
        const sentence = await ai.prompt(examplePrompt(word.word, word.description));
        example = (sentence ?? '').trim();
        if (example) await wordsDb.setExample(id, example);
    }
    const audio = await tts.getStream(word.word, 'ogg_opus', transcription || undefined, example || undefined);
    await wordsDb.setVoice(id, audio);
    return {ok: true, transcription};
}

async function regenerateExample(id: string) {
    const wordsDb = resolve(WordsDatabase);
    const prisma = resolve(PrismaClient);
    const word = await prisma.word.findUnique({where: {id}, select: {word: true, description: true}});
    if (!word) return {error: 'not found'};
    const ai = resolve(AiModel);
    const sentence = await ai.prompt(examplePrompt(word.word, word.description));
    const example = (sentence ?? '').trim();
    if (example) await wordsDb.setExample(id, example);
    return {ok: true, example};
}

async function regenerateImage(id: string) {
    const wordsDb = resolve(WordsDatabase);
    const prisma = resolve(PrismaClient);
    const word = await prisma.word.findUnique({where: {id}, select: {word: true, description: true, example: true}});
    if (!word) return {error: 'not found'};
    const ai = resolve(AiModel);
    let example = word.example?.trim();
    if (!example) {
        const sentence = await ai.prompt(examplePrompt(word.word, word.description));
        example = (sentence ?? '').trim();
        if (example) await wordsDb.setExample(id, example);
    }
    const imagen = resolve(Imagen);
    const image = await imagen.generate(imagePrompt(example));
    if (image) {
        await wordsDb.setImage(id, image);
        return {ok: true};
    }
    return {error: 'image generation failed'};
}

async function regenerateSatQuiz(id: string) {
    const prisma = resolve(PrismaClient);
    const target = await prisma.word.findUnique({where: {id}, select: {id: true, word: true, description: true, type: true, embedding: true}});
    if (!target) return {error: 'not found'};

    // No chat context here, so use the same POS/embedding-similarity strategy as
    // pickDistractorWords directly; falls back to a random same-POS pick when
    // embeddings aren't available.
    let distractors: Word[] = pickSimilarDistractors(target as Word, await resolve(WordsDatabase).getAllLight(), 3);
    if (distractors.length < 3) {
        distractors = await prisma.$queryRaw<Word[]>`
            SELECT id, word, description FROM "Word"
            WHERE id != ${id} AND description IS NOT NULL
              AND (${target.type}::text IS NULL OR type = ${target.type})
            ORDER BY RANDOM() LIMIT 3
        `;
    }
    if (distractors.length < 3) return {error: 'not enough words to build a quiz'};
    const quiz = await generateSatQuiz(target as Word, distractors);
    if (!quiz) return {error: 'quiz generation failed'};
    await resolve(WordsDatabase).setSatQuiz(id, quiz);
    return {ok: true, satQuiz: quiz};
}

// Steps within a scheduled word: index 0 is the intro, 1..n mirror WordSendHandlers
// (see word-send-handlers.ts) — quiz, voice, image, flashcard, example.
const WORD_STEP_LABELS = ['Intro', 'Word Quiz', 'Voice', 'Image', 'Flashcard', 'Example'];

async function getChats(query: Record<string, string>) {
    const prisma = resolve(PrismaClient);
    const take = 50;
    const skip = ((+(query.page ?? 1)) - 1) * take;
    const search = query.search?.trim();
    const where = search ? {
        OR: [
            {id: {contains: search, mode: 'insensitive' as const}},
            {username: {contains: search, mode: 'insensitive' as const}},
            {userId: {contains: search, mode: 'insensitive' as const}},
        ],
    } : {};
    const [chats, total] = await Promise.all([
        prisma.chat.findMany({
            where, orderBy: {createdAt: 'desc'}, take, skip,
            select: {
                id: true, username: true, userId: true, isPaused: true, englishLevel: true,
                planStart: true, planDurationDays: true, wordOrder: true, createdAt: true,
            },
        }),
        prisma.chat.count({where}),
    ]);
    const introduced = await prisma.message.groupBy({
        by: ['chatId'],
        where: {chatId: {in: chats.map(c => c.id)}, kind: 'word'},
        _count: {_all: true},
    });
    const introducedMap = new Map(introduced.map(r => [r.chatId, r._count._all]));
    return {
        chats: chats.map(c => ({
            id: c.id,
            username: c.username,
            userId: c.userId,
            isPaused: c.isPaused,
            level: c.englishLevel,
            planStart: c.planStart,
            planDurationDays: c.planDurationDays,
            wordCount: c.wordOrder.length,
            introducedCount: introducedMap.get(c.id) ?? 0,
            createdAt: c.createdAt,
        })),
        total,
        pages: Math.ceil(total / take),
    };
}

async function getChatTimetable(chatId: string) {
    const prisma = resolve(PrismaClient);
    const chat = await prisma.chat.findUnique({
        where: {id: chatId},
        select: {
            id: true, username: true, userId: true, isPaused: true, englishLevel: true,
            planStart: true, planDurationDays: true, wordOrder: true,
        },
    });
    if (!chat) return {error: 'not found'};

    const {words, quizzes} = await resolve(SrsPlanner).projectPlan(chatId);
    const items: {kind: string; step: string; label: string; description: string; date: string; projected: boolean}[] = [];
    for (const w of words) {
        w.dates.forEach((d, i) => {
            items.push({
                kind: 'word',
                step: WORD_STEP_LABELS[i] ?? `Step ${i + 1}`,
                label: w.word,
                description: w.description,
                date: d.toISOString(),
                projected: !w.scheduled,
            });
        });
    }
    quizzes.forEach((q, i) => {
        items.push({
            kind: 'quiz',
            step: 'SAT Quiz',
            label: `Quiz #${i + 1}`,
            description: '',
            date: q.date.toISOString(),
            projected: !q.scheduled,
        });
    });
    items.sort((a, b) => a.date.localeCompare(b.date));

    return {
        chat: {
            id: chat.id,
            username: chat.username,
            userId: chat.userId,
            isPaused: chat.isPaused,
            level: chat.englishLevel,
            planStart: chat.planStart,
            planDurationDays: chat.planDurationDays,
            wordCount: chat.wordOrder.length,
        },
        now: new Date().toISOString(),
        items,
    };
}

// ---- Fastify adapter (for start.ts / local dev) ----

export function registerAdminRoutes(app: any) {
    app.route({
        method: ['GET', 'POST'],
        url: ADMIN_PATH,
        handler: async (req: any, res: any) => {
            await handleAdminRequest(
                {path: req.url.split('?')[0], method: req.method, query: req.query, body: req.body},
                res.raw
            );
        }
    });
    app.route({
        method: ['GET', 'POST'],
        url: ADMIN_PATH + '/*',
        handler: async (req: any, res: any) => {
            await handleAdminRequest(
                {path: req.url.split('?')[0], method: req.method, query: req.query, body: req.body},
                res.raw
            );
        }
    });
}

const adminHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MemoBot Cache Admin</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #0f0f0f; color: #e0e0e0; padding: 20px; max-width: 1200px; margin: 0 auto; }
  h1 { margin-bottom: 20px; color: #fff; }

  .search-bar { display: flex; gap: 10px; margin-bottom: 24px; }
  .search-bar input {
    flex: 1; background: #1a1a1a; color: #e0e0e0; border: 1px solid #333;
    padding: 10px 14px; border-radius: 8px; font-size: 15px; outline: none;
  }
  .search-bar input:focus { border-color: #555; }
  .search-bar button {
    background: #2a2a2a; color: #ccc; border: 1px solid #444; padding: 10px 20px;
    border-radius: 8px; cursor: pointer; font-size: 14px;
  }
  .search-bar button:hover { background: #333; color: #fff; }

  .pagination { display: flex; gap: 8px; justify-content: center; margin: 20px 0; }
  .pagination button {
    background: #1a1a1a; color: #ccc; border: 1px solid #333; padding: 6px 12px;
    border-radius: 6px; cursor: pointer;
  }
  .pagination button:hover { background: #333; }
  .pagination button.active { background: #444; color: #fff; border-color: #666; }
  .pagination button:disabled { opacity: 0.3; cursor: default; }

  .stats { color: #666; font-size: 0.85em; margin-bottom: 16px; }

  .word-grid { display: flex; flex-direction: column; gap: 12px; }

  .word-card {
    background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px;
    padding: 16px; transition: border-color 0.15s;
  }
  .word-card:hover { border-color: #444; }
  .word-card.expanded .card-body { display: grid; }

  .card-header {
    display: flex; align-items: center; gap: 12px; cursor: pointer; user-select: none;
  }
  .card-header:hover .word-title { color: #fff; }
  .word-title { font-size: 1.2em; font-weight: 700; color: #ddd; transition: color 0.15s; }
  .word-desc { color: #888; font-size: 0.9em; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .word-meta { display: flex; gap: 8px; flex-wrap: wrap; }
  .badge {
    padding: 2px 8px; border-radius: 10px; font-size: 0.75em; font-weight: 600;
  }
  .badge-level { background: #1a3a2a; color: #5a5; }
  .badge-type { background: #2a2a3a; color: #88a; }
  .badge-cache { background: #3a2a1a; color: #a85; }
  .badge-cache.yes { background: #1a3a1a; color: #5a5; }

  .card-body {
    display: none; grid-template-columns: 220px 1fr; gap: 16px;
    margin-top: 16px; padding-top: 16px; border-top: 1px solid #2a2a2a;
  }

  .card-images { display: flex; flex-direction: column; gap: 12px; }
  .card-images img {
    width: 100%; border-radius: 8px; display: block; background: #111;
    cursor: pointer; transition: opacity 0.15s;
  }
  .card-images img:hover { opacity: 0.85; }
  .img-label { color: #666; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }

  .card-assets { display: flex; flex-direction: column; gap: 12px; }

  .asset-section { background: #111; border-radius: 8px; padding: 14px; }
  .asset-section h3 {
    font-size: 0.8em; color: #666; text-transform: uppercase;
    letter-spacing: 0.5px; margin-bottom: 8px;
  }
  .asset-content { color: #ccc; font-size: 0.95em; line-height: 1.5; min-height: 20px; }
  .asset-content audio { width: 100%; margin-top: 4px; height: 36px; }

  .btn {
    background: #2a2a2a; color: #ccc; border: 1px solid #444; padding: 5px 12px;
    border-radius: 6px; cursor: pointer; font-size: 0.8em; transition: all 0.15s;
    display: inline-flex; align-items: center; gap: 5px;
  }
  .btn:hover { background: #333; color: #fff; border-color: #555; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .spinner {
    width: 12px; height: 12px; border: 2px solid #555; border-top-color: #ccc;
    border-radius: 50%; animation: spin 0.6s linear infinite; display: none;
  }
  .btn.loading .spinner { display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .actions { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
  .error { color: #e55; font-size: 0.85em; margin-top: 4px; }
  .success { color: #5a5; font-size: 0.85em; margin-top: 4px; }
  .loading-text { color: #888; padding: 40px; text-align: center; }
  .empty { color: #666; padding: 40px; text-align: center; }

  .quiz-question { color: #ddd; white-space: pre-wrap; line-height: 1.5; }
  .quiz-answers { display: flex; flex-direction: column; gap: 6px; }
  .quiz-answer {
    background: #111; border: 1px solid #2a2a2a; border-radius: 8px; padding: 8px 12px;
    color: #ccc; display: flex; gap: 10px; align-items: baseline;
  }
  .quiz-answer.correct { background: #1a3a1a; border-color: #2a5a2a; color: #8d8; }
  .quiz-label { font-weight: 700; color: #888; min-width: 18px; }
  .quiz-answer.correct .quiz-label { color: #6c6; }

  .lightbox-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85);
    align-items: center; justify-content: center; z-index: 1000; cursor: zoom-out;
  }
  .lightbox-overlay.open { display: flex; }
  .lightbox-overlay img {
    max-width: min(75vw, 75vh); max-height: min(75vw, 75vh);
    object-fit: contain; border-radius: 8px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  }

  .tabs { display: flex; gap: 8px; margin-bottom: 20px; }
  .tabs button {
    background: #1a1a1a; color: #999; border: 1px solid #333; padding: 8px 18px;
    border-radius: 8px; cursor: pointer; font-size: 0.9em;
  }
  .tabs button:hover { color: #ccc; }
  .tabs button.active { background: #2a2a2a; color: #fff; border-color: #555; }

  .chat-list { display: flex; flex-direction: column; gap: 8px; }
  .chat-row {
    background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px;
    padding: 12px 16px; display: flex; align-items: center; gap: 14px; cursor: pointer;
  }
  .chat-row:hover { border-color: #444; }
  .chat-row .chat-name { font-weight: 700; color: #ddd; min-width: 160px; }
  .chat-row .chat-meta { color: #888; font-size: 0.85em; flex: 1; }
  .badge-paused { background: #3a1a1a; color: #a55; }

  .timetable-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .timetable-header button { background: #1a1a1a; color: #ccc; border: 1px solid #333; padding: 6px 14px; border-radius: 6px; cursor: pointer; }
  .timetable-header button:hover { background: #333; }
  .timetable-list { display: flex; flex-direction: column; gap: 6px; }
  .tt-row {
    display: flex; align-items: center; gap: 10px; padding: 8px 12px;
    background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; font-size: 0.9em;
  }
  .tt-row.past { opacity: 0.55; }
  .tt-row.projected { border-style: dashed; }
  .tt-date { color: #888; min-width: 150px; font-variant-numeric: tabular-nums; }
  .tt-kind { padding: 2px 8px; border-radius: 10px; font-size: 0.75em; font-weight: 600; min-width: 76px; text-align: center; }
  .tt-kind.word { background: #2a2a3a; color: #88a; }
  .tt-kind.quiz { background: #3a2a1a; color: #a85; }
  .tt-step { color: #666; font-size: 0.8em; min-width: 80px; }
  .tt-label { color: #ddd; font-weight: 600; }
  .tt-desc { color: #777; font-size: 0.85em; }
  .tt-now-divider { display: flex; align-items: center; gap: 10px; color: #6c6; font-size: 0.8em; margin: 4px 0; }
  .tt-now-divider::before, .tt-now-divider::after { content: ''; flex: 1; height: 1px; background: #2a5a2a; }
  .load-more { text-align: center; margin: 10px 0; }
  .load-more button { background: #1a1a1a; color: #ccc; border: 1px solid #333; padding: 6px 16px; border-radius: 6px; cursor: pointer; }
  .load-more button:hover { background: #333; }
</style>
</head>
<body>
<h1>MemoBot Cache Admin</h1>

<div class="tabs">
  <button id="tab-words" class="active" onclick="showTab('words')">Words</button>
  <button id="tab-chats" onclick="showTab('chats')">Chats</button>
</div>

<div id="wordsPage">
  <div class="search-bar">
    <input type="text" id="search" placeholder="Search words..." />
    <button onclick="doSearch()">Search</button>
  </div>

  <div id="stats" class="stats"></div>
  <div id="content"></div>
  <div id="pager" class="pagination"></div>
</div>

<div id="chatsPage" style="display:none">
  <div id="chatsList">
    <div class="search-bar">
      <input type="text" id="chatSearch" placeholder="Search chats by id, username or userId..." />
      <button onclick="doChatSearch()">Search</button>
    </div>
    <div id="chatStats" class="stats"></div>
    <div id="chatContent"></div>
    <div id="chatPager" class="pagination"></div>
  </div>

  <div id="timetableView" style="display:none">
    <div class="timetable-header">
      <button onclick="closeTimetable()">&laquo; Back to chats</button>
      <div id="timetableTitle"></div>
    </div>
    <div id="timetableContent"></div>
  </div>
</div>

<div id="lightbox" class="lightbox-overlay" onclick="closeLightbox()">
  <img id="lightboxImg" src="" alt="expanded image" />
</div>

<script>
const BASE = location.pathname.replace(/\\/$/, '');
const API = BASE + '/api';
let currentPage = 1;
let currentSearch = '';

const searchInput = document.getElementById('search');
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

function doSearch() {
  currentSearch = searchInput.value.trim();
  currentPage = 1;
  loadWords();
}

async function api(path, options) {
  const res = await fetch(API + path, options);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

async function loadWords() {
  const content = document.getElementById('content');
  const pager = document.getElementById('pager');
  const stats = document.getElementById('stats');
  content.innerHTML = '<div class="loading-text">Loading...</div>';
  pager.innerHTML = '';
  try {
    const params = new URLSearchParams({page: currentPage});
    if (currentSearch) params.set('search', currentSearch);
    const data = await api('/words?' + params);
    stats.textContent = data.total + ' words total' + (currentSearch ? ' matching "' + currentSearch + '"' : '');
    if (!data.words.length) {
      content.innerHTML = '<div class="empty">No words found.</div>';
      return;
    }
    content.innerHTML = '<div class="word-grid" id="wordGrid"></div>';
    const grid = document.getElementById('wordGrid');
    data.words.forEach(w => grid.appendChild(createCard(w)));
    renderPager(data.pages);
  } catch (e) {
    content.innerHTML = '<div class="error">Failed to load: ' + esc(e.message) + '</div>';
  }
}

function renderPager(pages) {
  const pager = document.getElementById('pager');
  if (pages <= 1) { pager.innerHTML = ''; return; }
  let html = '<button onclick="goPage(' + Math.max(1, currentPage - 1) + ')"' + (currentPage <= 1 ? ' disabled' : '') + '>&laquo;</button>';
  const start = Math.max(1, currentPage - 3);
  const end = Math.min(pages, currentPage + 3);
  for (let i = start; i <= end; i++) {
    html += '<button onclick="goPage(' + i + ')"' + (i === currentPage ? ' class="active"' : '') + '>' + i + '</button>';
  }
  html += '<button onclick="goPage(' + Math.min(pages, currentPage + 1) + ')"' + (currentPage >= pages ? ' disabled' : '') + '>&raquo;</button>';
  pager.innerHTML = html;
}

function goPage(p) { currentPage = p; loadWords(); }

function createCard(w) {
  const card = document.createElement('div');
  card.className = 'word-card';
  card.id = 'card-' + w.id;

  const badges =
    (w.level ? '<span class="badge badge-level">' + esc(w.level) + '</span>' : '') +
    (w.type ? '<span class="badge badge-type">' + esc(w.type) + '</span>' : '') +
    '<span class="badge badge-cache ' + (w.hasVoice ? 'yes' : '') + '" data-cache="voice">voice: ' + (w.hasVoice ? 'yes' : 'no') + '</span>' +
    '<span class="badge badge-cache ' + (w.hasImage ? 'yes' : '') + '" data-cache="image">image: ' + (w.hasImage ? 'yes' : 'no') + '</span>' +
    '<span class="badge badge-cache ' + (w.satQuiz ? 'yes' : '') + '" data-cache="quiz">quiz: ' + (w.satQuiz ? 'yes' : 'no') + '</span>';

  card.innerHTML =
    '<div class="card-header" onclick="toggleCard(this)">' +
      '<span class="word-title">' + esc(w.word) + '</span>' +
      '<span class="word-desc">' + esc(w.description || '') + '</span>' +
      '<div class="word-meta">' + badges + '</div>' +
    '</div>' +
    '<div class="card-body">' +
      '<div class="card-images">' +
        '<div>' +
          '<div class="img-label">Flashcard</div>' +
          '<img data-src="' + API + '/words/' + w.id + '/flashcard" alt="flashcard" onclick="event.stopPropagation(); openLightbox(this.src)" />' +
        '</div>' +
        '<div id="imagen-' + w.id + '">' +
          '<div class="img-label">AI Image</div>' +
          (w.hasImage
            ? '<img data-src="' + API + '/words/' + w.id + '/image" alt="ai image" onclick="event.stopPropagation(); openLightbox(this.src)" />'
            : '<div style="color:#555;font-size:0.85em">Not generated</div>') +
        '</div>' +
      '</div>' +
      '<div class="card-assets">' +
        '<div class="asset-section">' +
          '<h3>Voice &amp; Transcription</h3>' +
          '<div class="asset-content" id="voice-' + w.id + '">' +
            (w.transcription ? '<div style="color:#999;margin-bottom:4px">' + esc(w.transcription) + '</div>' : '') +
            (w.hasVoice ? '<audio controls preload="none" src="' + API + '/words/' + w.id + '/voice"></audio>' : '<span style="color:#555">Not generated</span>') +
          '</div>' +
          '<div class="actions">' +
            '<button class="btn" data-id="' + w.id + '" onclick="regenVoice(event)"><span class="spinner"></span>Regenerate Voice</button>' +
          '</div>' +
        '</div>' +
        '<div class="asset-section">' +
          '<h3>Example</h3>' +
          '<div class="asset-content" id="example-' + w.id + '">' +
            (w.example ? '<p>' + esc(w.example) + '</p>' : '<span style="color:#555">Not generated</span>') +
          '</div>' +
          '<div class="actions">' +
            '<button class="btn" data-id="' + w.id + '" onclick="regenExample(event)"><span class="spinner"></span>Regenerate Example</button>' +
          '</div>' +
        '</div>' +
        '<div class="asset-section">' +
          '<h3>SAT Quiz</h3>' +
          '<div class="asset-content" id="satquiz-' + w.id + '">' +
            renderSatQuiz(w.satQuiz) +
          '</div>' +
          '<div class="actions">' +
            '<button class="btn" data-id="' + w.id + '" onclick="regenSatQuiz(event)"><span class="spinner"></span>Regenerate SAT Quiz</button>' +
          '</div>' +
        '</div>' +
        '<div class="asset-section">' +
          '<h3>AI Image</h3>' +
          '<div class="actions">' +
            '<button class="btn" data-id="' + w.id + '" onclick="regenImage(event)"><span class="spinner"></span>Regenerate Image</button>' +
          '</div>' +
          '<div id="imagen-status-' + w.id + '"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  return card;
}

function renderSatQuiz(q) {
  if (!q) return '<span style="color:#555">Not generated</span>';
  const answers = Array.isArray(q.answers) ? q.answers : [];
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  const question = esc(q.question).replace(/&lt;b&gt;_____&lt;\\/b&gt;/g, '<b>_____</b>');
  const answersHtml = answers.map((a, i) =>
    '<div class="quiz-answer' + (i === q.correct ? ' correct' : '') + '">' +
      '<span class="quiz-label">' + (labels[i] || (i + 1)) + '</span>' +
      '<span>' + esc(a) + '</span>' +
    '</div>').join('');
  return '<div class="quiz-question">' + question + '</div>' +
         '<div class="quiz-answers" style="margin-top:8px">' + answersHtml + '</div>';
}

function toggleCard(header) {
  const card = header.parentElement;
  card.classList.toggle('expanded');
  if (card.classList.contains('expanded')) {
    card.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  }
}

async function regenVoice(e) {
  e.stopPropagation();
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  setLoading(btn, true);
  const el = document.getElementById('voice-' + id);
  try {
    const data = await api('/words/' + id + '/regenerate/voice', {method: 'POST'});
    el.innerHTML =
      (data.transcription ? '<div style="color:#999;margin-bottom:4px">' + esc(data.transcription) + '</div>' : '') +
      '<audio controls src="' + API + '/words/' + id + '/voice?' + Date.now() + '"></audio>';
    updateBadge(id, 'voice', true);
  } catch (err) {
    el.innerHTML += '<div class="error">Failed: ' + esc(err.message) + '</div>';
  }
  setLoading(btn, false);
}

async function regenExample(e) {
  e.stopPropagation();
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  setLoading(btn, true);
  const el = document.getElementById('example-' + id);
  try {
    const data = await api('/words/' + id + '/regenerate/example', {method: 'POST'});
    el.innerHTML = '<p>' + esc(data.example || 'No example generated') + '</p>';
  } catch (err) {
    el.innerHTML += '<div class="error">Failed: ' + esc(err.message) + '</div>';
  }
  setLoading(btn, false);
}

async function regenImage(e) {
  e.stopPropagation();
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  setLoading(btn, true);
  const status = document.getElementById('imagen-status-' + id);
  try {
    const data = await api('/words/' + id + '/regenerate/image', {method: 'POST'});
    if (data.ok) {
      const imgEl = document.getElementById('imagen-' + id);
      imgEl.innerHTML = '<div class="img-label">AI Image</div><img src="' + API + '/words/' + id + '/image?' + Date.now() + '" alt="ai image" onclick="event.stopPropagation(); openLightbox(this.src)" />';
      status.innerHTML = '<div class="success">Image regenerated</div>';
      updateBadge(id, 'image', true);
    } else {
      status.innerHTML = '<div class="error">' + esc(data.error || 'failed') + '</div>';
    }
  } catch (err) {
    status.innerHTML = '<div class="error">Failed: ' + esc(err.message) + '</div>';
  }
  setLoading(btn, false);
}

async function regenSatQuiz(e) {
  e.stopPropagation();
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  setLoading(btn, true);
  const el = document.getElementById('satquiz-' + id);
  try {
    const data = await api('/words/' + id + '/regenerate/satquiz', {method: 'POST'});
    if (data.satQuiz) {
      el.innerHTML = renderSatQuiz(data.satQuiz);
      updateBadge(id, 'quiz', true);
    } else {
      el.innerHTML = '<div class="error">' + esc(data.error || 'failed') + '</div>';
    }
  } catch (err) {
    el.innerHTML += '<div class="error">Failed: ' + esc(err.message) + '</div>';
  }
  setLoading(btn, false);
}

function updateBadge(id, type, hasIt) {
  const card = document.getElementById('card-' + id);
  if (!card) return;
  const badge = card.querySelector('[data-cache="' + type + '"]');
  if (badge) {
    badge.textContent = type + ': ' + (hasIt ? 'yes' : 'no');
    badge.classList.toggle('yes', hasIt);
  }
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}

function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lightboxImg').src = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ---- tabs ----

function showTab(tab) {
  document.getElementById('tab-words').classList.toggle('active', tab === 'words');
  document.getElementById('tab-chats').classList.toggle('active', tab === 'chats');
  document.getElementById('wordsPage').style.display = tab === 'words' ? '' : 'none';
  document.getElementById('chatsPage').style.display = tab === 'chats' ? '' : 'none';
  if (tab === 'chats' && !chatsLoaded) {
    chatsLoaded = true;
    loadChats();
  }
}

// ---- chats ----

let chatsLoaded = false;
let currentChatPage = 1;
let currentChatSearch = '';

const chatSearchInput = document.getElementById('chatSearch');
chatSearchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doChatSearch(); });

function doChatSearch() {
  currentChatSearch = chatSearchInput.value.trim();
  currentChatPage = 1;
  loadChats();
}

async function loadChats() {
  const content = document.getElementById('chatContent');
  const pager = document.getElementById('chatPager');
  const stats = document.getElementById('chatStats');
  content.innerHTML = '<div class="loading-text">Loading...</div>';
  pager.innerHTML = '';
  try {
    const params = new URLSearchParams({page: currentChatPage});
    if (currentChatSearch) params.set('search', currentChatSearch);
    const data = await api('/chats?' + params);
    stats.textContent = data.total + ' chats total' + (currentChatSearch ? ' matching "' + currentChatSearch + '"' : '');
    if (!data.chats.length) {
      content.innerHTML = '<div class="empty">No chats found.</div>';
      return;
    }
    content.innerHTML = '<div class="chat-list" id="chatList"></div>';
    const list = document.getElementById('chatList');
    data.chats.forEach(c => list.appendChild(createChatRow(c)));
    renderChatPager(data.pages);
  } catch (e) {
    content.innerHTML = '<div class="error">Failed to load: ' + esc(e.message) + '</div>';
  }
}

function renderChatPager(pages) {
  const pager = document.getElementById('chatPager');
  if (pages <= 1) { pager.innerHTML = ''; return; }
  let html = '<button onclick="goChatPage(' + Math.max(1, currentChatPage - 1) + ')"' + (currentChatPage <= 1 ? ' disabled' : '') + '>&laquo;</button>';
  const start = Math.max(1, currentChatPage - 3);
  const end = Math.min(pages, currentChatPage + 3);
  for (let i = start; i <= end; i++) {
    html += '<button onclick="goChatPage(' + i + ')"' + (i === currentChatPage ? ' class="active"' : '') + '>' + i + '</button>';
  }
  html += '<button onclick="goChatPage(' + Math.min(pages, currentChatPage + 1) + ')"' + (currentChatPage >= pages ? ' disabled' : '') + '>&raquo;</button>';
  pager.innerHTML = html;
}

function goChatPage(p) { currentChatPage = p; loadChats(); }

function createChatRow(c) {
  const row = document.createElement('div');
  row.className = 'chat-row';
  row.onclick = () => openTimetable(c.id, c.username || c.id);
  const planInfo = c.planDurationDays
    ? c.introducedCount + '/' + c.wordCount + ' words introduced &middot; ' + c.planDurationDays + 'd plan'
    : 'no plan yet';
  row.innerHTML =
    '<span class="chat-name">' + esc(c.username || c.id) + '</span>' +
    '<span class="chat-meta">' + esc(c.userId || '') + ' &middot; ' + planInfo + '</span>' +
    (c.isPaused ? '<span class="badge badge-cache badge-paused">paused</span>' : '') +
    (c.level ? '<span class="badge badge-level">' + esc(c.level) + '</span>' : '');
  return row;
}

// ---- timetable ----

async function openTimetable(chatId, title) {
  document.getElementById('chatsList').style.display = 'none';
  const view = document.getElementById('timetableView');
  view.style.display = '';
  document.getElementById('timetableTitle').textContent = title;
  const content = document.getElementById('timetableContent');
  content.innerHTML = '<div class="loading-text">Loading...</div>';
  try {
    const data = await api('/chats/' + encodeURIComponent(chatId) + '/timetable');
    if (data.error) {
      content.innerHTML = '<div class="error">' + esc(data.error) + '</div>';
      return;
    }
    renderTimetable(data);
  } catch (e) {
    content.innerHTML = '<div class="error">Failed to load: ' + esc(e.message) + '</div>';
  }
}

function closeTimetable() {
  document.getElementById('timetableView').style.display = 'none';
  document.getElementById('chatsList').style.display = '';
}

const TT_WINDOW = 25;

function renderTimetable(data) {
  const content = document.getElementById('timetableContent');
  const now = data.now;
  const items = data.items;
  const splitIdx = items.findIndex(it => it.date > now);
  const nowIdx = splitIdx === -1 ? items.length : splitIdx;

  let pastShown = Math.min(TT_WINDOW, nowIdx);
  let nextShown = Math.min(TT_WINDOW, items.length - nowIdx);

  function draw() {
    const pastStart = nowIdx - pastShown;
    const pastItems = items.slice(pastStart, nowIdx);
    const nextItems = items.slice(nowIdx, nowIdx + nextShown);
    let html = '';
    if (pastStart > 0) {
      html += '<div class="load-more"><button onclick="ttShowMorePast()">Show ' + Math.min(TT_WINDOW, pastStart) + ' earlier (' + pastStart + ' more)</button></div>';
    }
    html += '<div class="timetable-list">' + pastItems.map(it => renderTtRow(it, true)).join('') + '</div>';
    html += '<div class="tt-now-divider">NOW &middot; ' + new Date(now).toLocaleString() + '</div>';
    html += '<div class="timetable-list">' + nextItems.map(it => renderTtRow(it, false)).join('') + '</div>';
    const remaining = items.length - nowIdx - nextShown;
    if (remaining > 0) {
      html += '<div class="load-more"><button onclick="ttShowMoreNext()">Show ' + Math.min(TT_WINDOW, remaining) + ' more (' + remaining + ' left)</button></div>';
    }
    content.innerHTML = html;
  }

  window.ttShowMorePast = () => { pastShown = Math.min(nowIdx, pastShown + TT_WINDOW); draw(); };
  window.ttShowMoreNext = () => { nextShown = Math.min(items.length - nowIdx, nextShown + TT_WINDOW); draw(); };

  draw();
}

function renderTtRow(it, isPast) {
  return '<div class="tt-row' + (isPast ? ' past' : '') + (it.projected ? ' projected' : '') + '">' +
    '<span class="tt-date">' + new Date(it.date).toLocaleString() + '</span>' +
    '<span class="tt-kind ' + it.kind + '">' + it.kind + '</span>' +
    '<span class="tt-step">' + esc(it.step) + '</span>' +
    '<span class="tt-label">' + esc(it.label) + '</span>' +
    '<span class="tt-desc">' + esc(it.description || '') + '</span>' +
    (it.projected ? '<span class="tt-desc" style="color:#666">(projected)</span>' : '') +
    '</div>';
}

showTab('words');
loadWords();
</script>
</body>
</html>`;
