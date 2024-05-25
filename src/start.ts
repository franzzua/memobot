import { fastify } from "fastify";
import { path, telegraf } from "./index";

const app = fastify({
    
});

app.post('/'+path, (req, res) => {
    return telegraf({
        body: req.body,
        query: Object.fromEntries(new URLSearchParams(req.query as string).entries()),
        // @ts-ignore
    }, Object.assign(res, {
        sendStatus: code => res.status<number>(code)
    }))
})

app.listen({
    host: '0.0.0.0',
    port: +(process.env.PORT ?? 5800),
}).then(x => {
    console.log('listen', x);
})