import fastify from "fastify";
import { resolve } from "@di";
import { TelegrafApi } from "./api";

const app = fastify({

});
const tg = resolve(TelegrafApi);

app.post(`/api/telegraf/${tg.secretPathComponent()}`, tg.hook);
app.get('/', req => `Ok`);

app.listen({
    port: +process.env.PORT!,
    host: '0.0.0.0'
});
