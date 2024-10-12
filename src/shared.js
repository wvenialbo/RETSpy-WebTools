import { Logger } from "./logging";

/**
 * The filename of the module.
 * @type {string}
 * @constant
 */
const MODULE_FILENAME = "shared.js";

/**
 * The logger for the module.
 * @type {Logger}
 * @constant
 */
const logger = new Logger(MODULE_FILENAME);

export { logger };
