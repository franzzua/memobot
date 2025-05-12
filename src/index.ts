import { di } from "@di";
import { Logger } from "./logger/logger";
import { GCSLogger } from "./logger/gcs.logger";
import {telegram} from "./functions";
export { telegram, task } from "./functions";

di.override(Logger, GCSLogger);
telegram(null as any, null as any);