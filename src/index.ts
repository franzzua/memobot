import {di} from "@cmmn/core";
import {Logger} from "./logger/logger";
import {GCSLogger} from "./logger/gcs.logger";

di.override(Logger, GCSLogger);
const telegram = await import("./functions/telegram");
export {telegram};
