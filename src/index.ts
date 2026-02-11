import {di} from "@cmmn/core";
import {Logger} from "./logger/logger";
import {GCSLogger} from "./logger/gcs.logger";
import {execSync} from "node:child_process";
import path from "node:path";

di.override(Logger, GCSLogger);
di.resolve(Logger).measure(() => execSync(`npx prisma generate && npx prisma migrate deploy`, {
    stdio: 'inherit',
    cwd: path.dirname(import.meta.dirname),
    env: process.env,
}), 'prisma init ' + process.env.DATABASE_URL?.replace(/:\/\/.*\@/, '://***@'))


const telegram = await import("./functions/telegram");
export {telegram};
