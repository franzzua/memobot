import type {ServerResponse} from "node:http";
import {botMove, DuelError, Lexicon, newDuel, Player, publicView, Rng, StudyWord, take} from "./engine";
import type {DuelRecord, DuelStore} from "./store";
import {TelegramUser, validateInitData} from "./auth";

// Word Duel mini app: GET /app serves the page, POST /app/api/* is its JSON API. Every API
// call carries Telegram's signed initData in the body; the user id comes only from there.
export const DUEL_PATH = '/app';

export type Notifier = {
    /** Sends a message with an "Open game" button; deletes `replaces` first. Returns the new message id. */
    send(userId: string, html: string, duelId: string, replaces: number | null): Promise<number | null>;
    botUsername(): Promise<string>;
};
export type DuelDeps = {
    store: DuelStore;
    lexicon(): Promise<Lexicon>;
    /** Words to hide on a new board, preferring the creator's own study plan. */
    studyWords(userId: string): Promise<StudyWord[]>;
    notifier: Notifier;
    botToken: string;
    page(): Promise<string>;
    rng?: Rng;
};
type Req = { path: string; method: string; body?: any };
type Res = ServerResponse;

export function isDuelRequest(path: string) {
    return path === DUEL_PATH || path.startsWith(DUEL_PATH + '/');
}

class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

export async function handleDuelRequest(req: Req, res: Res, deps: DuelDeps): Promise<void> {
    const path = req.path.split('?')[0].replace(/\/$/, '');
    try {
        if (path === DUEL_PATH && req.method.toUpperCase() === 'GET') {
            const html = await deps.page();
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Length': Buffer.byteLength(html),
                'Cache-Control': 'no-cache',
            });
            res.end(html);
            return;
        }
        if (req.method.toUpperCase() !== 'POST' || !path.startsWith(DUEL_PATH + '/api/'))
            throw new HttpError(404, 'Not found');

        const body = parseBody(req.body);
        const user = validateInitData(body.initData, deps.botToken);
        if (!user) throw new HttpError(401, 'Open Word Duel from the Telegram bot.');
        const api = new DuelApi(deps, user);
        const action = path.slice((DUEL_PATH + '/api/').length);
        switch (action) {
            case 'games':
                return sendJson(res, await api.games());
            case 'new':
                return sendJson(res, await api.create(!!body.vsBot));
            case 'game':
                return sendJson(res, await api.game(String(body.id)));
            case 'join':
                return sendJson(res, await api.join(String(body.id)));
            case 'take':
                return sendJson(res, await api.take(String(body.id), Number(body.cell), Number(body.version)));
            default:
                throw new HttpError(404, 'Not found');
        }
    } catch (err: any) {
        const status = err instanceof HttpError ? err.status : err instanceof DuelError ? 400 : 500;
        if (status === 500) console.error('Word Duel error:', err);
        if (!res.headersSent) sendJson(res, {error: status === 500 ? 'Something went wrong. Try again.' : err.message}, status);
    }
}

class DuelApi {
    constructor(private deps: DuelDeps, private user: TelegramUser) {
    }

    private seat(d: DuelRecord): Player | null {
        if (d.player0 === this.user.id) return 0;
        if (d.player1 === this.user.id) return 1;
        return null;
    }

    private async view(d: DuelRecord) {
        const you = this.seat(d);
        return {
            id: d.id,
            version: d.version,
            status: d.status,
            vsBot: d.vsBot,
            you,
            canJoin: d.status === 'waiting' && you === null,
            invite: d.status === 'waiting' && you === 0 ? await this.inviteLink(d.id) : null,
            players: [{name: d.name0}, {name: d.name1 ?? 'Waiting for a friend'}],
            state: publicView(d.state),
        };
    }

    private async inviteLink(id: string) {
        return `https://t.me/${await this.deps.notifier.botUsername()}?start=duel_${id}`;
    }

    private async load(id: string) {
        const d = await this.deps.store.get(id);
        if (!d) throw new HttpError(404, 'This game no longer exists.');
        return d;
    }

    async games() {
        const list = await this.deps.store.listFor(this.user.id, 30);
        return {
            me: this.user,
            games: list.map(d => {
                const you = this.seat(d)!;
                const opp = (you ^ 1) as Player;
                return {
                    id: d.id,
                    status: d.status,
                    opponent: you === 0 ? (d.name1 ?? null) : d.name0,
                    yourTurn: d.status === 'active' && d.state.turn === you,
                    you: d.state.scores[you],
                    them: d.state.scores[opp],
                    updatedAt: d.updatedAt,
                };
            }),
        };
    }

    async create(vsBot: boolean) {
        const state = newDuel(await this.deps.studyWords(this.user.id), this.deps.rng);
        const d = await this.deps.store.create({
            player0: this.user.id,
            name0: this.user.name,
            player1: vsBot ? 'bot' : null,
            name1: vsBot ? 'Bot' : null,
            vsBot,
            status: vsBot ? 'active' : 'waiting',
            state,
            notifications: [null, null],
        });
        return this.view(d);
    }

    async game(id: string) {
        return this.view(await this.load(id));
    }

    async join(id: string) {
        const d = await this.load(id);
        if (this.seat(d) !== null) return this.view(d);
        if (d.status !== 'waiting') throw new HttpError(409, 'Someone else already joined this game.');
        d.player1 = this.user.id;
        d.name1 = this.user.name;
        d.status = 'active';
        await this.notify(d, 0, `<b>${escape(this.user.name)}</b> joined your Word Duel. Your move!`);
        if (!await this.deps.store.save(d)) throw new HttpError(409, 'Someone else already joined this game.');
        return this.view(d);
    }

    async take(id: string, cell: number, version: number) {
        const d = await this.load(id);
        const you = this.seat(d);
        if (you === null) throw new HttpError(403, "You're not playing in this game.");
        if (d.status !== 'active') throw new HttpError(409, d.status === 'over' ? 'The game is over.' : 'Wait for your friend to join.');
        if (d.version !== version) throw new HttpError(409, 'The board changed. Refreshing.');
        if (d.state.turn !== you) throw new HttpError(409, "It's not your turn.");

        const lex = await this.deps.lexicon();
        take(d.state, lex, cell);
        if (d.vsBot) {
            while (!d.state.over && d.state.turn === 1)
                take(d.state, lex, botMove(d.state, lex, 1, this.deps.rng));
        }
        if (d.state.over) d.status = 'over';

        const opp = (you ^ 1) as Player;
        if (!d.vsBot) {
            const s = d.state;
            await this.notify(d, opp, s.over
                ? `Word Duel with <b>${escape(this.user.name)}</b> is over: ${s.scores[opp]}–${s.scores[you]}. ${s.scores[opp] > s.scores[you] ? 'You won!' : s.scores[opp] < s.scores[you] ? 'You lost this one.' : "It's a draw."}`
                : s.turn === opp
                    ? `Your move in Word Duel with <b>${escape(this.user.name)}</b>. Score ${s.scores[opp]}–${s.scores[you]}.`
                    : null);
        }
        if (!await this.deps.store.save(d)) throw new HttpError(409, 'The board changed. Refreshing.');
        return this.view(d);
    }

    // Telegram calls must finish before the response: Cloud Functions throttle CPU after it.
    private async notify(d: DuelRecord, to: Player, html: string | null) {
        const userId = to === 0 ? d.player0 : d.player1;
        if (!html || !userId || userId === 'bot') return;
        try {
            d.notifications[to] = await this.deps.notifier.send(userId, html, d.id, d.notifications[to]);
        } catch (err) {
            console.error('Word Duel notify failed:', err);
        }
    }
}

function escape(s: string) {
    return s.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}

function parseBody(body: any): any {
    if (typeof body !== 'string') return body ?? {};
    try {
        return JSON.parse(body);
    } catch {
        return {};
    }
}

function sendJson(res: Res, data: any, status = 200) {
    const body = JSON.stringify(data);
    res.writeHead(status, {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)});
    res.end(body);
}
