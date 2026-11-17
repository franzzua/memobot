import {fastify} from "fastify";
import {di} from "@cmmn/core";
import {Logger} from "./logger/logger";
import {ConsoleLogger} from "./logger/console.logger";
import process from "node:process";
import {getDuelDeps, init, telegram} from "./functions/telegram";
import {DUEL_PATH, handleDuelRequest} from "./duel/api";
import {seedData} from "../prisma/seed";
import {registerAdminRoutes} from "./api/admin";

di.override(Logger, ConsoleLogger);
await seedData();
init();
async function initApp() {
    const app = fastify({});
    registerAdminRoutes(app);
    // Word Duel mini app: same raw-response handoff as the admin routes.
    for (const url of [DUEL_PATH, DUEL_PATH + '/*']) {
        app.route({
            method: ['GET', 'POST'],
            url,
            handler: async (req: any, res: any) => {
                await handleDuelRequest(
                    {path: req.url.split('?')[0], method: req.method, body: req.body},
                    res.raw,
                    getDuelDeps(),
                );
            },
        });
    }
    app.all('/*', (req, res) => {
        return telegram({
            body: req.body,
            query: Object.fromEntries(new URLSearchParams(req.query as string).entries()),
            method: req.method,
            path: req.url
        }, Object.assign(res, {
            sendStatus: code => res.status<number>(code).send()
        } as any))
    })
    return app;
}

initApp().then(app => app.listen({
    host: '0.0.0.0',
    port: +(process.env.PORT ?? 5800),
}).then(x => {
    console.log('listen', x);
}));