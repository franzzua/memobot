import { di } from "@di";
import { Logger } from "./logger/logger";
import { GCSLogger } from "./logger/gcs.logger";
import { telegram, task } from "./functions";

di.override(Logger, GCSLogger);

export default {
    get telegram() {
        telegram.init();
        return telegram;
    },
    task
}