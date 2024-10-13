import { Logger } from "./logging.js";

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

/**
 * Class providing utility functions for date manipulation.
 */
class DateUtils {
  /**
   * Gets the current date and time in ISO format.
   *
   * @returns {string} The current date and time in ISO format
   *          (YYYY-MM-DDTHH:MM:SS.SSS).
   */
  static currentISODate() {
    const now = DateUtils.#now();
    return now.toISOString();
  }

  /**
   * Truncates a date to the specified interval.
   *
   * @param {Date} date The date to be truncated.
   * @param {number} interval The interval in milliseconds to which the date
   *        should be truncated.
   * @returns {Date} The truncated date.
   */
  static truncateDate(date, interval) {
    const timestamp = Math.floor(date.getTime() / interval) * interval;
    return new Date(timestamp);
  }

  /**
   * (Private function) Gets the current date and time.
   *
   * @returns {Date} The current date and time.
   */
  static #now() {
    return new Date();
  }
}

/**
 * Class providing utility functions for working with filenames.
 */
class FilenameUtils {
  /**
   * Builds a filename suitable for an archive containing the provided URLs.
   *
   * @param {string[]} urls An array of URLs to be included in the archive.
   * @param {string} prefix A prefix to be prepended to the filename
   *        (optional).
   * @param {string} type The desired archive type (optional).
   * @returns {string} The constructed filename for the archive.
   */
  static buildArchiveFilename(urls, prefix, type) {
    const lastURL = urls.at(-1);
    let filename = FilenameUtils.getFilename(lastURL);
    if (type) {
      filename = FilenameUtils.renameExtension(filename, type);
    }
    return `${prefix}${filename}`;
  }

  /**
   * Builds an array of filenames for images based on the provided URLs.
   *
   * @param {string[]} urls An array of URLs representing image files.
   * @param {string} type The desired file extension for the image filenames
   *        (optional).
   * @returns {string[]} An array of filenames derived from the URLs, with
   *        optional extension renaming based on the `type` parameter.
   */
  static buildImageFilenames(urls, type) {
    let filenames = FilenameUtils.getFilenames(urls);
    if (type) {
      filenames = FilenameUtils.renameExtensions(filenames, type);
    }
    return filenames;
  }

  /**
   * Extracts the filename from a URL.
   *
   * @param {string} url The URL to extract the filename from.
   * @returns {string} The extracted filename.
   */
  static getFilename(url) {
    const pathname = FilenameUtils.#pathname(url);
    return pathname.split("/").pop();
  }

  /**
   * Extracts the filenames from an array of URLs.
   *
   * @param {string[]} urls An array of URLs.
   * @returns {string[]} An array of extracted filenames.
   */
  static getFilenames(urls) {
    return urls.map((element) => FilenameUtils.getFilename(element));
  }

  /**
   * Renames the extension of a filename.
   *
   * @param {string} filename The original filename.
   * @param {string} type The new file extension (with the dot).
   * @returns {string} The renamed filename.
   */
  static renameExtension(filename, type) {
    return filename.replace(/\.[^./]+$/, type);
  }

  /**
   * Renames the extensions of an array of filenames.
   *
   * @param {string[]} filenames An array of filenames.
   * @param {string} type The new file extension (with the dot).
   * @returns {string[]} An array of renamed filenames.
   */
  static renameExtensions(filenames, type) {
    return filenames.map((filename) =>
      FilenameUtils.renameExtension(filename, type),
    );
  }

  /**
   * (Private function) Extracts the pathname from a URL.
   *
   * @param {string} url The URL to extract the pathname from.
   * @returns {string} The extracted pathname.
   */
  static #pathname(url) {
    return new URL(url).pathname;
  }
}

export { DateUtils, FilenameUtils, logger };
