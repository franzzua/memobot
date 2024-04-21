import fastify from "fastify";
import { resolve } from "@di";
import { TelegrafApi } from "./api/index";
import process from "node:process";

const app = fastify({

});
const tg = resolve(TelegrafApi);

tg.run(app);
app.get('/', req => `Ok`);

app.listen({
    port: +process.env.PORT!,
    host: '0.0.0.0'
});

process.once('SIGINT', () => tg.stop('SIGINT'))
process.once('SIGTERM', () => tg.stop('SIGTERM'))