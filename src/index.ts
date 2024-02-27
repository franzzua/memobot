import {bot} from "./bot/memobot.js";
import fastify from "fastify";

const app = fastify({

});

app.post(`/api/telegraf/${bot.secretPathComponent()}`, req => {
    return bot.handleUpdate(req.body as any);
});

app.listen({
    port: +process.env.PORT!,
    host: '0.0.0.0'
});
