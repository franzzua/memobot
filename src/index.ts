import {di} from "@cmmn/core";
import {Logger} from "./logger/logger";
import {GCSLogger} from "./logger/gcs.logger";
import {init} from "./functions/telegram";

di.override(Logger, GCSLogger);
init();

export {telegram} from "./functions/telegram";
