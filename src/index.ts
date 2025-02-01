import { di, resolve } from "@di";
import { TelegrafApi } from "./api/telegraf.api";
import process from "node:process";
import { Logger } from "./logger/logger";
import { GCSLogger } from "./logger/gcs.logger";

di.override(Logger, GCSLogger);

// is used by Google Function
export { telegram, whatsapp, task } from "./functions";
