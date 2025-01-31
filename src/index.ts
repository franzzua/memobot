import { di, resolve } from "@di";
import { TelegrafApi } from "./api/telegraf.api";
import process from "node:process";
import { Logger } from "./logger/logger";
import { GCSLogger } from "./logger/gcs.logger";

di.override(Logger, GCSLogger);

const tg = resolve(TelegrafApi);
tg.init().catch(e => {
    console.error(e);
    process.exit(1);
});

// is used by Google Function
export { telegraf } from "./functions/telegraf";
