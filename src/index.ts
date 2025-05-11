import { di } from "@di";
import { Logger } from "./logger/logger";
import { GCSLogger } from "./logger/gcs.logger";


// is used by Google Function
export { telegram, task } from "./functions";
