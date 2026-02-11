import {di} from "@cmmn/core";
import {Logger} from "./logger/logger";
import {GCSLogger} from "./logger/gcs.logger";
import {execSync} from "node:child_process";
import path from "node:path";

execSync(`npx prisma generate`, {
    stdio: 'inherit',
    cwd: path.dirname(import.meta.dirname),
    env: process.env,
});

console.log('migrate to ', process.env.DATABASE_URL?.replace(/:\/\/.*\@/, '://***@'));

execSync(`npx prisma migrate deploy`, {
    stdio: 'inherit',
    cwd: path.dirname(import.meta.dirname),
    env: process.env,
});

di.override(Logger, GCSLogger);

const telegram = await import("./functions/telegram");
export {telegram};
