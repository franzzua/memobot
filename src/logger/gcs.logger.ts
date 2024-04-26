import { Logger } from "./logger";
import { LoggingBunyan } from "@google-cloud/logging-bunyan";
import bunyan from "bunyan";

export class GCSLogger extends Logger {
    private logging = new LoggingBunyan({
    });
    private logger =  bunyan.createLogger({
        // The JSON payload of the log as it appears in Cloud Logging
        // will contain "name": "my-service"
        name: 'telegraf',
        streams: [
            // Log to the console at 'info' and above
            // {stream: process.stdout, level: 'info'},
            // And log to Cloud Logging, logging at 'info' and above
            this.logging.stream('info'),
        ],
    });

    send(data: any) {
        this.logger.info(data);
    }
}