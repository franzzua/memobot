import {resolve} from "@di";
import {Logger} from "../logger/logger";
import type {Request, Response} from "@google-cloud/functions-framework";
import {ServerResponse} from "node:http";

export function baseFunction(name: string, handle: (
    req: Pick<Request, "body" | "query">,
    res: Pick<Response, "sendStatus"> & ServerResponse
) => Promise<any>) {
    return (
        req: Pick<Request, "body" | "query">,
        res: Pick<Response, "sendStatus"> & ServerResponse
    ) => {
        const logger = resolve(Logger);
        return logger.measure(async () => {
            return handle(req, res);
        }, `function.${name}`).catch((err) => {
            logger.send({
                error: err.message ?? err
            })
        });
    }
}