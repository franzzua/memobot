import { fastify } from "fastify";
import { defaultContainer, resolve } from "@di";
import { Logger } from "./logger/logger";
import { ConsoleLogger } from "./logger/console.logger";
import { telegraf } from "./telegraf";
import { TelegrafApi } from "./api/telegraf.api";
import process from "node:process";

defaultContainer.override(Logger, ConsoleLogger);
const app = fastify({
    
});
const tg = resolve(TelegrafApi);

app.post('/'+tg.path, (req, res) => {
    return telegraf({
        body: req.body,
        query: Object.fromEntries(new URLSearchParams(req.query as string).entries()),
        // @ts-ignore
    }, Object.assign(res, {
        sendStatus: code => res.status<number>(code).send()
    }))
})

app.listen({
    host: '0.0.0.0',
    port: +(process.env.PORT ?? 5800),
}).then(x => {
    tg.run().catch(e => {
        console.error(e);
        process.exit(1);
    })
    console.log('listen', x);
})