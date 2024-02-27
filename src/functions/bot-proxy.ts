import {
    app,
    HttpRequest,
    HttpResponseInit,
    InvocationContext
} from "@azure/functions";
import {bot} from "../bot/memobot.js";

export async function status(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const json = await request.json();
    await bot.handleUpdate(json as any).catch(err => {
        context.error(err);
    });
    return {  status: 204 };
}

app.http('telegraf', {
    route: `telegraf/${bot.secretPathComponent()}`,
    authLevel: 'anonymous',
    handler: status,
});