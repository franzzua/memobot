import {describe, test} from "node:test";
import {expect} from "expect";
import {PassThrough} from "node:stream";
import {ServerResponse, IncomingMessage} from "node:http";
import {handleDuelRequest, DuelDeps} from "./api";
import {MemoryDuelStore} from "./store";
import {Lexicon} from "./engine";
import {signInitData, validateInitData} from "./auth";

const TOKEN = "123456:test-token";
const STUDY = ["BOLSTER", "REFUTE", "SKEPTIC", "CONCEDE", "VALIDATE", "ABRUPT", "ADAMANT", "INFER"]
    .map(word => ({word, desc: `meaning of ${word.toLowerCase()}`}));

function initData(id: number, first_name: string, authDate = Math.floor(Date.now() / 1000)) {
    return signInitData({auth_date: String(authDate), query_id: "q", user: JSON.stringify({id, first_name})}, TOKEN);
}

function setup() {
    const sent: { to: string; html: string; replaces: number | null }[] = [];
    let msg = 100;
    const deps: DuelDeps = {
        store: new MemoryDuelStore(),
        botToken: TOKEN,
        lexicon: async () => new Lexicon(["loser", "stone", "notes"]),
        studyWords: async () => STUDY,
        page: async () => "<html>duel</html>",
        notifier: {
            send: async (to, html, _id, replaces) => { sent.push({to, html, replaces}); return ++msg; },
            botUsername: async () => "memo_test_bot",
        },
    };
    async function call(path: string, body?: any, method = "POST") {
        const res = new ServerResponse(new IncomingMessage(new PassThrough() as any));
        const chunks: Buffer[] = [];
        const sink = new PassThrough();
        sink.on("data", c => chunks.push(c));
        res.assignSocket(sink as any);
        await handleDuelRequest({path, method, body}, res, deps);
        const raw = Buffer.concat(chunks).toString();
        const text = raw.slice(raw.indexOf("\r\n\r\n") + 4);
        return {status: res.statusCode, body: text.startsWith("{") ? JSON.parse(text) : text};
    }
    return {deps, sent, call};
}

describe("duel initData", () => {
    test("accepts Telegram-signed data and rejects tampering, other tokens and old data", () => {
        const good = initData(42, "Ann");
        expect(validateInitData(good, TOKEN)).toEqual({id: "42", name: "Ann"});
        expect(validateInitData(good.replace("Ann", "Bob"), TOKEN)).toBeNull();
        expect(validateInitData(good, "other:token")).toBeNull();
        expect(validateInitData(initData(42, "Ann", 1000), TOKEN)).toBeNull();
        expect(validateInitData("", TOKEN)).toBeNull();
    });
});

describe("duel api", () => {
    test("serves the page and refuses calls without valid initData", async () => {
        const {call} = setup();
        expect((await call("/app", undefined, "GET")).body).toBe("<html>duel</html>");
        expect((await call("/app/api/games", {initData: "nope"})).status).toBe(401);
    });

    test("vs bot: your move is answered by the bot in the same request", async () => {
        const {call} = setup();
        const ann = initData(1, "Ann");
        const created = (await call("/app/api/new", {initData: ann, vsBot: true})).body;
        expect(created).toMatchObject({status: "active", you: 0, vsBot: true});
        expect(created.state.hidden.every((h: any) => h.word === null)).toBe(true);

        const after = (await call("/app/api/take", {initData: ann, id: created.id, cell: 0, version: created.version})).body;
        expect(after.state.moves.map((m: any) => m.player)).toEqual([0, 1]);
        expect(after.state.turn).toBe(0);

        const stale = await call("/app/api/take", {initData: ann, id: created.id, cell: 1, version: created.version});
        expect(stale.status).toBe(409);
    });

    test("friend game: invite, join, turns and 'your move' messages", async () => {
        const {call, sent} = setup();
        const ann = initData(1, "Ann"), bob = initData(2, "Bob"), eve = initData(3, "Eve");
        const g = (await call("/app/api/new", {initData: ann, vsBot: false})).body;
        expect(g).toMatchObject({status: "waiting", invite: `https://t.me/memo_test_bot?start=duel_${g.id}`});

        expect((await call("/app/api/take", {initData: ann, id: g.id, cell: 0, version: g.version})).status).toBe(409);

        const bobView = (await call("/app/api/game", {initData: bob, id: g.id})).body;
        expect(bobView).toMatchObject({canJoin: true, you: null});
        const joined = (await call("/app/api/join", {initData: bob, id: g.id})).body;
        expect(joined).toMatchObject({status: "active", you: 1});
        expect(sent.at(-1)).toMatchObject({to: "1", replaces: null});
        expect((await call("/app/api/join", {initData: eve, id: g.id})).status).toBe(409);

        expect((await call("/app/api/take", {initData: bob, id: g.id, cell: 0, version: joined.version})).body.error).toMatch(/not your turn/);
        const t1 = (await call("/app/api/take", {initData: ann, id: g.id, cell: 0, version: joined.version})).body;
        expect(t1.state.turn).toBe(1);
        expect(sent.at(-1)).toMatchObject({to: "2"});
        const t2 = (await call("/app/api/take", {initData: bob, id: g.id, cell: 1, version: t1.version})).body;
        expect(t2.state.turn).toBe(0);
        // Ann's earlier "joined" message (101) is replaced by the new one
        expect(sent.at(-1)).toMatchObject({to: "1", replaces: 101});

        const list = (await call("/app/api/games", {initData: ann})).body;
        expect(list.games[0]).toMatchObject({id: g.id, opponent: "Bob", yourTurn: true});
        expect((await call("/app/api/take", {initData: eve, id: g.id, cell: 2, version: t2.version})).status).toBe(403);
    });
});
