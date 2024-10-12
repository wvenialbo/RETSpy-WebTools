import { backdict, dict } from "./common";

/**
 * The filename of the module.
 * @type {string}
 * @constant
 */
const MODULE_FILENAME = "logging.js";

/**
 * An array of logging levels identifiers in increasing order of severity.
 */
const LEVELS = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL", "UNKNOWN"];

/**
 * A map (enumeration) of logging levels to their corresponding string values.
 */
const LEVEL = dict(LEVELS, LEVELS);

/**
 * A map of logging levels to their corresponding integer values.
 */
const LEVELMAP = backdict(LEVELS);

/**
 * A class for managing and querying logs.
 *
 * Provides methods for pushing new logs, querying logs by various criteria,
 * and formatting logs into a string representation.
 */
class LoggerStore {
  #header;
  #footer;
  #notify;
  #formatter;
  #logs;

  /**
   * Constructs a LoggerStore object for managing and querying logs.
   *
   * @param {string} header (Optional) A header to be prepended to the
   *        formatted log output.
   * @param {string} footer (Optional) A footer to be appended to the formatted
   *        log output.
   * @param {function} notify (Optional) A callback function to be called when
   *        a new log is pushed.
   * @param {function} formatter (Optional) A function to format log objects
   *        into strings.
   * @param {Array<Object>} logs (Optional) An initial array of log objects.
   */
  constructor(header, footer, notify, formatter, logs) {
    this.#header = header || "";
    this.#footer = footer || "";
    this.#notify = notify || (() => {});
    this.#formatter = formatter || LoggerStore.#defaultFormatter;
    this.#logs = logs || [];
  }

  /**
   * Pushes a new log entry to the store.
   *
   * @param {string} levelId The logging level ID.
   * @param {string} moduleId The module ID.
   * @param {string} errorCode The error code.
   * @param {string} errorMessage The error message.
   */
  push(levelId, moduleId, errorCode, errorMessage) {
    const log = this.#buildLogEntry(levelId, moduleId, errorCode, errorMessage);
    this.#logs.push(log);
    this.#notify(log);
  }

  /**
   * Queries the log records for logs within a specified date range.
   *
   * @param {Date} begin (Optional) The beginning date for the query.
   * @param {Date} end (Optional) The ending date for the query.
   * @returns {LoggerStore} A new LoggerStore object containing the filtered
   *          logs.
   */
  queryByDate(begin, end) {
    let logs = [];
    if (!begin && !end) {
      logs = this.#logs;
    } else if (!begin && end) {
      logs = this.#logs.filter((log) => log.timestamp <= end);
    } else if (begin && !end) {
      logs = this.#logs.filter((log) => begin <= log.timestamp);
    } else if (begin <= end) {
      logs = this.#logs.filter(
        (log) => begin <= log.timestamp && log.timestamp <= end,
      );
    } else {
      this.#logLoggerError("LS201", "Invalid date range.");
    }
    return this.#build(logs);
  }

  /**
   * Queries the log records for logs with the specified error codes.
   *
   * @param {string|string[]} errorCodes The error code(s) to filter by.
   * @returns {LoggerStore} A new LoggerStore object containing the filtered
   *          logs.
   */
  queryByErrorCode(errorCodes) {
    errorCodes = Array.isArray(errorCodes) ? errorCodes : [errorCodes];
    const logs = this.#logs.filter((log) => errorCodes.includes(log.code));
    return this.#build(logs);
  }

  /**
   * Queries the log records for logs based on the specified level specification.
   *
   * @param {string} levelSpec A string specifying the level filter (e.g.,
   *        ">=INFO<FATAL").
   * @returns {LoggerStore} A new LoggerStore object containing the filtered
   *          logs.
   */
  queryByLevel(levelSpec) {
    const levelIds = this.#buildLevelRange(levelSpec);
    const logs = this.#logs.filter((log) => levelIds.includes(log.level));
    return this.#build(logs);
  }

  /**
   * Queries the log records for logs from the specified modules.
   *
   * @param {string|string[]} moduleIds The module ID(s) to filter by.
   * @returns {LoggerStore} A new LoggerStore object containing the filtered
   *          logs.
   */
  queryByModuleId(moduleIds) {
    moduleIds = Array.isArray(moduleIds) ? moduleIds : [moduleIds];
    const logs = this.#logs.filter((log) => moduleIds.includes(log.code));
    return this.#build(logs);
  }

  /**
   * Converts the log records to a string representation.
   *
   * @returns {string} A string representation of the log store, including
   *          header, footer, and formatted logs.
   */
  toString() {
    let result = this.#header ? `${this.#header}\n` : "";
    for (const log of this.#logs) {
      result += `${this.#formatter(log)}\n`;
    }
    result += this.#footer ? `\n${this.#footer}\n` : "";
    return result;
  }

  /**
   * (Private method) Builds a new LoggerStore object with the filtered logs.
   *
   * @param {Array<Object>} logs The filtered log objects.
   * @returns {LoggerStore} A new LoggerStore object with the filtered logs.
   */
  #build(logs) {
    return new LoggerStore(
      this.#header,
      this.#footer,
      this.#notify,
      this.#formatter,
      logs,
    );
  }

  /**
   * (Private method) Builds a level filter function based on the specified
   * relation and level ID.
   *
   * @param {string} relation The relation operator (e.g., "<", "<=", ">",
   *        ">=", "==").
   * @param {string} levelId The logging level ID.
   * @returns {function} A function that filters log objects based on the
   *          specified level and relation.
   */
  #buildLevelFilter(relation, levelId) {
    const refLevel = LEVELMAP[levelId];
    switch (relation) {
      case "<": {
        return (level) => LEVELMAP[level] < refLevel;
      }
      case "<=": {
        return (level) => LEVELMAP[level] <= refLevel;
      }
      case ">": {
        return (level) => LEVELMAP[level] > refLevel;
      }
      case ">=": {
        return (level) => LEVELMAP[level] >= refLevel;
      }
      case "==": {
        return (level) => level === levelId;
      }
      default: {
        this.#logLoggerError("LS101", `Invalid relation: ${relation}`);
        return () => false;
      }
    }
  }

  /**
   * (Private method) Builds a range of logging levels based on the specified
   * level specification.
   *
   * @param {string} levelSpec A string specifying the level filter (e.g.,
   *        ">INFO").
   * @returns {Array<string>} An array of logging levels that match the
   *          specified filter.
   */
  #buildLevelRange(levelSpec) {
    const pattern = /(?:([<>]|[<=>]=)(DEBUG|INFO|WARN|ERROR|FATAL))/g;
    const matches = levelSpec.matchAll(pattern);
    const items = Array.from(matches, (match) => [match[1], match[2]]);
    if (items.length === 0) {
      this.#logLoggerError(
        "LS102",
        `Invalid level specification: ${levelSpec}`,
      );
      return [];
    }
    let current = new Set(LEVELS);
    for (const item of items) {
      const [relation, levelId] = item;
      const filter = this.#buildLevelFilter(relation, levelId);
      const levels = LEVELS.filter((levelId) => filter(levelId));
      current = current.intersection(new Set(levels));
    }
    return [...current];
  }

  /**
   * (Private method) Creates a new log object based on provided data.
   *
   * @param {string} level The logging level ID.
   * @param {string} moduleId The module ID.
   * @param {string} errorCode The error code.
   * @param {string} errorMessage The error message.
   * @returns {Object} A new log object with the specified properties.
   */
  #buildLogEntry(levelId, moduleId, errorCode, errorMessage) {
    if (!LEVELS.includes(levelId)) {
      this.#logLoggerError(
        "LS001",
        `Invalid level: ${levelId}, using ${LEVEL.UNKNOWN}.`,
      );
      levelId = LEVEL.UNKNOWN;
    }
    return {
      code: errorCode,
      level: levelId,
      message: errorMessage,
      module: moduleId,
      timestamp: new Date(),
    };
  }

  /**
   * (Private method) Formats a log object into a string representation.
   *
   * @param {Object} log The log object to format.
   * @returns {string} The formatted log string.
   */
  static #defaultFormatter(log) {
    return (
      `${log.timestamp} [${log.level}] - ${log.module} :` +
      ` (${log.code}) ${log.message}`
    );
  }

  #logLoggerError(code, message) {
    const error_code = code;
    const log = this.#buildLogEntry(
      LEVEL.ERROR,
      MODULE_FILENAME,
      error_code,
      message,
    );
    this.#logs.push(log);
    console.error(`(${error_code}) ${message}`);
  }

  /**
   * Gets the array of log entries stored in the LoggerStore.
   *
   * @returns {Array<Object>} An array of log objects.
   */
  get logs() {
    return this.#logs;
  }
}

/**
 * Represents a logger instance for a specific module.
 *
 * Provides methods for logging messages at different levels (debug, info,
 * warn, etc.) and querying logs based on various criteria.
 */
class Logger {
  #moduleId;
  #store;

  /**
   * Represents a logger instance for a specific module.
   *
   * Provides methods for logging messages at different levels (debug, info,
   * warn, etc.) and querying logs based on various criteria.
   *
   * @param {string} moduleId The ID of the module for which this logger
   *        instance is used.
   * @param {LoggerStore} store (Optional) An existing LoggerStore instance to
   *        use for storing logs. Defaults to a new LoggerStore instance.
   */
  constructor(moduleId, store) {
    this.#moduleId = moduleId;
    this.#store = store || new LoggerStore();
  }

  /**
   * Logs a debug message with a code and message.
   *
   * @param {string} code An error code associated with the debug message.
   * @param {string} message The debug message to be logged.
   */
  debug(code, message) {
    this.#store.push(LEVEL.DEBUG, this.#moduleId, code, message);
  }

  /**
   * Logs an error message with a code and message.
   *
   * @param {string} code An error code associated with the warning message.
   * @param {string} message The warning message to be logged.
   */
  error(code, message) {
    this.#store.push(LEVEL.ERROR, this.#moduleId, code, message);
  }

  /**
   * Logs a fatal error message with a code and message.
   *
   * @param {string} code An error code associated with the debug message.
   * @param {string} message The debug message to be logged.
   */
  fatal(code, message) {
    this.#store.push(LEVEL.FATAL, this.#moduleId, code, message);
  }

  /**
   * Logs an info message with a code and message.
   *
   * @param {string} code An error code associated with the warning message.
   * @param {string} message The warning message to be logged.
   */
  info(code, message) {
    this.#store.push(LEVEL.INFO, this.#moduleId, code, message);
  }

  /**
   * Queries the log records for logs within a specified date range.
   *
   * @param {Date} begin (Optional) The beginning date for the query.
   * @param {Date} end (Optional) The ending date for the query.
   * @returns {LoggerStore} A new LoggerStore object containing the filtered
   *          logs.
   */
  queryByDate(begin, end) {
    return this.#store.queryByModuleId(this.#moduleId).queryByDate(begin, end);
  }

  /**
   * Queries the log records for logs with the specified error codes.
   *
   * @param {string|string[]} errorCodes The error code(s) to filter by.
   * @returns {LoggerStore} A new LoggerStore object containing the filtered
   *          logs.
   */
  queryByErrorCode(errorCodes) {
    return this.#store
      .queryByModuleId(this.#moduleId)
      .queryByErrorCode(errorCodes);
  }

  /**
   * Queries the log records for logs based on the specified level specification.
   *
   * @param {string} levelSpec A string specifying the level filter (e.g.,
   *        ">=INFO<FATAL").
   * @returns {LoggerStore} A new LoggerStore object containing the filtered
   *          logs.
   */
  queryByLevel(levelSpec) {
    return this.#store.queryByModuleId(this.#moduleId).queryByLevel(levelSpec);
  }

  /**
   * Sets the underlying LoggerStore instance used for storing logs.
   *
   * @param {LoggerStore} store The LoggerStore instance to use for storing
   *        logs.
   */
  setStore(store) {
    this.#store = store;
  }

  /**
   * Converts the log records to a string representation.
   *
   * @returns {string} A string representation of the log store, including
   *          header, footer, and formatted logs.
   */
  toString() {
    return this.#store.queryByModuleId(this.#moduleId).toString();
  }

  /**
   * Logs a warning message with a code and message.
   *
   * @param {string} code An error code associated with the warning message.
   * @param {string} message The warning message to be logged.
   */
  warn(code, message) {
    this.#store.push(LEVEL.WARN, this.#moduleId, code, message);
  }

  /**
   * Gets the underlying LoggerStore instance used for storing logs.
   *
   * @returns {LoggerStore} The current LoggerStore instance.
   */
  get store() {
    return this.#store;
  }
}

export { LEVEL, Logger, LoggerStore };
