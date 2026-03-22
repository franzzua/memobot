import {di} from "@cmmn/core";
import {Logger} from "./logger/logger";
import {GCSLogger} from "./logger/gcs.logger";
import {execSync} from "node:child_process";
import path from "node:path";

di.override(Logger, GCSLogger);
const logger = di.resolve(Logger);
logger.send({ event: 'init', db: process.env.DATABASE_URL?.replace(/:\/\/.*\@/, '://***@')});
logger.measure(() => execSync(`npx prisma migrate deploy`, {
    stdio: 'inherit',
    cwd: path.dirname(import.meta.dirname),
    env: process.env,
}), 'prisma migrate')


const { telegram, init } = await import("./functions/telegram");
init();
export { telegram };
