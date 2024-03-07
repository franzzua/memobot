import {telegraf} from "./bot/api";
import fastify from "fastify";
import {MemoDoc} from "./bot/database";

const app = fastify({

});

app.post(`/api/telegraf/${telegraf.secretPathComponent()}`, req => {
    return telegraf.handleUpdate(req.body as any);
});

app.listen({
    port: +process.env.PORT!,
    host: '0.0.0.0'
});
