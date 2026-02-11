import {di} from "@cmmn/core";
import {Logger} from "./logger/logger";
import {GCSLogger} from "./logger/gcs.logger";
import {execSync} from "node:child_process";

console.log('migrate to ', process.env.DATABASE_URL?.replace(/:\/\/.*\@/, '://***@'));

execSync(`npx prisma migrate deploy`, {
    stdio: 'inherit',
    env: process.env,
});

di.override(Logger, GCSLogger);

export {telegram} from "./functions/telegram";
