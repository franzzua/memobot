import {di} from "@di";
import {Logger} from "./logger/logger";
import {GCSLogger} from "./logger/gcs.logger";
import {init} from "./functions";

di.override(Logger, GCSLogger);
init();

export {telegram} from "./functions/telegram";
