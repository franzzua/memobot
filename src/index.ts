import { di } from "@di";
import { Logger } from "./logger/logger";
import { GCSLogger } from "./logger/gcs.logger";

di.override(Logger, GCSLogger);

// is used by Google Function
export { telegram, task } from "./functions";
