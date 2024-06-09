import { defaultContainer, resolve } from "@di";
import { TelegrafApi } from "./api/telegraf.api";
import process from "node:process";
import { Logger } from "./logger/logger";
import { GCSLogger } from "./logger/gcs.logger";
export { telegraf } from "./telegraf";

defaultContainer.override(Logger, GCSLogger);

const tg = resolve(TelegrafApi);
tg.run().catch(e => {
    console.error(e);
    process.exit(1);
});
