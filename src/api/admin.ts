import {resolve} from "@cmmn/core";
import {PrismaClient} from "../../prisma/client";
import {WordsDatabase} from "../db/wordsDatabase";
import {ImageRender} from "../services/image-render";
import {TextToSpeech} from "../services/text-to-speech";
import {AiModel} from "../services/ai-model";
import {Imagen} from "../services/imagen";
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

async function getWords(query: Record<string, string>) {
    const prisma = resolve(PrismaClient);
    const take = 50;
    const skip = ((+(query.page ?? 1)) - 1) * take;
    const search = query.search;
    const where = search ? {word: {contains: search, mode: 'insensitive' as const}} : {};
    const [words, total] = await Promise.all([
        prisma.word.findMany({
            where, orderBy: {word: 'asc'}, take, skip,
            select: {id: true, word: true, description: true, type: true, level: true, frequency: true, transcription: true, example: true, voice: false, image: false}
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
    const stream = render.render();
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve());
        stream.on('error', reject);
    });
    sendBuffer(res, Buffer.concat(chunks), 'image/png');
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
    const word = await prisma.word.findUnique({where: {id}, select: {word: true, transcription: true}});
    if (!word) return {error: 'not found'};
    const tts = resolve(TextToSpeech);
    const ai = resolve(AiModel);
    let transcription = word.transcription?.trim();
    if (!transcription) {
        const ipa = await ai.prompt(`Return only the IPA phonetic transcription (in the standard /…/ form, no extra words) for the English word: "${word.word}".`);
        transcription = (ipa ?? '').trim();
        if (transcription) await wordsDb.setTranscription(id, transcription);
    }
    const audio = await tts.getStream(word.word, 'ogg_opus', transcription || undefined);
    await wordsDb.setVoice(id, audio);
    return {ok: true, transcription};
}

async function regenerateExample(id: string) {
    const wordsDb = resolve(WordsDatabase);
    const prisma = resolve(PrismaClient);
    const word = await prisma.word.findUnique({where: {id}, select: {word: true, description: true}});
    if (!word) return {error: 'not found'};
    const ai = resolve(AiModel);
    const meaningClause = word.description?.trim() ? ` in the sense of "${word.description.trim()}"` : '';
    const sentence = await ai.prompt(
        `Write one short, natural example sentence using the English word "${word.word}"${meaningClause}. Avoid military or depressive themes. Return only the sentence.`
    );
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
        const meaningClause = word.description?.trim() ? ` in the sense of "${word.description.trim()}"` : '';
        const sentence = await ai.prompt(
            `Write one short, natural example sentence using the English word "${word.word}"${meaningClause}. Avoid military or depressive themes. Return only the sentence.`
        );
        example = (sentence ?? '').trim();
        if (example) await wordsDb.setExample(id, example);
    }
    const imagen = resolve(Imagen);
    const prompt = `Image in rubberhouse style but #f68201-#209dba desaturated gamma, like pastel or Anderson films, ${example}`;
    const image = await imagen.generate(prompt);
    if (image) {
        await wordsDb.setImage(id, image);
        return {ok: true};
    }
    return {error: 'image generation failed'};
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
</style>
</head>
<body>
<h1>MemoBot Cache Admin</h1>

<div class="search-bar">
  <input type="text" id="search" placeholder="Search words..." />
  <button onclick="doSearch()">Search</button>
</div>

<div id="stats" class="stats"></div>
<div id="content"></div>
<div id="pager" class="pagination"></div>

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
    '<span class="badge badge-cache ' + (w.hasImage ? 'yes' : '') + '" data-cache="image">image: ' + (w.hasImage ? 'yes' : 'no') + '</span>';

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
          '<img data-src="' + API + '/words/' + w.id + '/flashcard" alt="flashcard" />' +
        '</div>' +
        '<div id="imagen-' + w.id + '">' +
          '<div class="img-label">AI Image</div>' +
          (w.hasImage
            ? '<img data-src="' + API + '/words/' + w.id + '/image" alt="ai image" />'
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
      imgEl.innerHTML = '<div class="img-label">AI Image</div><img src="' + API + '/words/' + id + '/image?' + Date.now() + '" alt="ai image" />';
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

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

loadWords();
</script>
</body>
</html>`;
