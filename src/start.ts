import {fastify} from "fastify";
import {di} from "@di";
import {Logger} from "./logger/logger";
import {ConsoleLogger} from "./logger/console.logger";
import process from "node:process";

di.override(Logger, ConsoleLogger);
async function initApp() {
    const app = fastify({});
    const functions = await import("./functions/index.js");
    for (let key in functions) {
        functions[key]();
        app.all('/' + key, (req, res) => {
            return functions[key]({
                body: req.body,
                query: Object.fromEntries(new URLSearchParams(req.query as string).entries()),
                method: req.method
                // @ts-ignore
            }, Object.assign(res, {
                sendStatus: code => res.status<number>(code).send()
            }))
        })
    }
    return app;
}

initApp().then(app => app.listen({
    host: '0.0.0.0',
    port: +(process.env.PORT ?? 5800),
}).then(x => {
    console.log('listen', x);
}));