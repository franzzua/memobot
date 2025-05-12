import { di } from "@di";
import { Logger } from "./logger/logger";
import { GCSLogger } from "./logger/gcs.logger";
export { telegram, task } from "./functions";

di.override(Logger, GCSLogger);
console.log('overrided:', di.resolve(Logger).constructor.name)