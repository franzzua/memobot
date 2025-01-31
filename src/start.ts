import {fastify} from "fastify";
import {di} from "@di";
import {Logger} from "./logger/logger";
import {ConsoleLogger} from "./logger/console.logger";
import {telegraf, whatsapp, task} from "./functions/index";
import process from "node:process";

di.override(Logger, ConsoleLogger);

const app = fastify({});

app.post('/telegraf', (req, res) => {
    console.log('telegraf', req.body);
    return telegraf({
        body: req.body,
        query: Object.fromEntries(new URLSearchParams(req.query as string).entries()),
        // @ts-ignore
    }, Object.assign(res, {
        sendStatus: code => res.status<number>(code).send()
    }))
})

app.post('/whatsapp', async (req, res) => {
    // @ts-ignore
    return whatsapp({
        body: req.body,
        query: Object.fromEntries(new URLSearchParams(req.query as string).entries()),
        // @ts-ignore
    }, Object.assign(res, {
        sendStatus: code => res.status<number>(code).send()
    }))
})

app.post('/task', async (req, res) => {
    // @ts-ignore
    return task({
        body: req.body,
        query: Object.fromEntries(new URLSearchParams(req.query as string).entries()),
        // @ts-ignore
    }, Object.assign(res, {
        sendStatus: code => res.status<number>(code).send()
    }))
})

app.get('/whatsapp', (req, res) => {
    // @ts-ignore
    const mode = req.query["hub.mode"];
    // @ts-ignore
    const token = req.query["hub.verify_token"];
    // @ts-ignore
    const challenge = req.query["hub.challenge"];
    console.log(mode, token, challenge);

    // check the mode and token sent are correct
    if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFICATION_TOKEN) {
        // respond with 200 OK and challenge token from the request
        console.log("Webhook verified successfully!");
        return challenge;
    } else {
        // respond with '403 Forbidden' if verify tokens do not match
        res.status(403);
    }
})

app.listen({
    host: '0.0.0.0',
    port: +(process.env.PORT ?? 5800),
}).then(x => {
    console.log('listen', x);
})