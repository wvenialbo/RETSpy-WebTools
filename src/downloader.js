import JSZip from "../lib/jszip.min";
import { dict } from "./common";
import { Logger } from "./logging";

/**
 * The filename of the module.
 * @type {string}
 * @constant
 */
const MODULE_FILENAME = "downloader.js";

/**
 * The filename of the README file in the archive.
 * @type {string}
 * @constant
 */
const README_TXT = "README.txt";

/**
 * The filename of the log file in the archive.
 * @type {string}
 * @constant
 */
const RETSPY_LOG = "RETSPY.log";

/**
 * An array of image types supported by the module.
 */
const IMAGES = ["PNG", "JPG", "WEBP"];

/**
 * A map of image types to their corresponding file extensions.
 */
const IMG_TYPE = dict(IMAGES, [".png", ".jpg", ".webp"]);

/**
 * A map of image types to their corresponding MIME types.
 */
const IMG_MEDIA = dict(IMAGES, ["image/png", "image/jpeg", "image/webp"]);

/**
 * A map (enumeration) of image types to their corresponding string values.
 */
const IMAGE = dict(IMAGES, IMAGES);

/**
 * The logger for the module.
 * @type {Logger}
 * @constant
 */
const logger = new Logger(MODULE_FILENAME);

/**
 * Class to save various types of content (Blob, Image, Video, Zip, etc.)
 * as a file with the specified filename.
 */
class FileSaver {
  /**
   * The delay (in milliseconds) before revoking the temporary URL created
   * for the content to avoid memory leaks.
   */
  static #revokeTimeout = 5000;

  static set revokeTimeout(value) {
    FileSaver.#revokeTimeout = value;
  }

  /**
   * Saves the provided content as a file with the specified filename.
   *
   * The returned object has the following properties:
   *
   * result = {
   *   ok: {boolean},
   *   message: {string}
   * }
   *
   * @param {Blob} content The content (String|Image|Video|Zip) to be saved.
   * @param {string} filename The desired filename for the saved file.
   * @returns {object} An object with an `ok` property indicating success
   *          and a `message` property with details (e.g., "empty", "success").
   */
  static save(content, filename) {
    if (content) {
      const objectURL = URL.createObjectURL(content);
      FileSaver.#saveAs(objectURL, filename);
      logger.debug("FS001", `File saved: '${filename}'`);
      return FileSaver.#buildResponse(true, "success");
    }
    logger.error("FS002", `Empty content: '${filename}'`);
    return FileSaver.#buildResponse(false, "empty");
  }

  static #buildResponse(ok, message) {
    return { ok, message };
  }

  /**
   * (Private function) Revokes the temporary URL created for the content
   * after a delay (`FileSaver.revokeTimeout`) to avoid memory leaks.
   *
   * @param {string} objectURL The temporary URL to be revoked.
   */
  static #revokeObjectURL(objectURL) {
    setTimeout(() => URL.revokeObjectURL(objectURL), FileSaver.#revokeTimeout);
  }

  /**
   * (Private function) Creates a temporary link, sets its href to the
   * objectURL, sets the download attribute to the filename, clicks the link
   * to trigger the download, and then revokes the objectURL.
   *
   * @param {string} objectURL The temporary URL for the content.
   * @param {string} filename The desired filename for the saved file.
   */
  static #saveAs(objectURL, filename) {
    const link = document.createElement("a");
    link.href = objectURL;
    link.download = filename;
    link.click();
    FileSaver.#revokeObjectURL(objectURL);
  }
}

/**
 * Class to archive entries (data or URLs) into a ZIP file with an optional
 * readme content.
 */
class FileArchiver {
  /**
   * Saves an archive containing provided entries and an optional readme to a
   * file with the specified filename.
   *
   * Each entry should have a `filename` property, the name under which the
   * file content, if any, will be archived and a `src` property containing the
   * URL from where the file content was downloaded, and, optionally, a `data`
   * property containing the contents of the file, if available, that is:
   *
   * entry = {
   *   filename: {string},
   *   src: {string},
   *   data: {Blob|undefined}
   * }
   *
   * @param {Array<{data: Blob, filename: string, src?: string}>} entries
   *        An array of objects representing entries to be archived.
   *        Each entry should have a `filename` property and either a `data`
   *        property (Blob or string) containing the content or a `src`
   *        property(string) containing a URL to load the content.
   * @param {string} filename The desired filename for the archive.
   * @param {string} readme Optional readme content to include in the archive.
   * @returns {Promise<object>} A promise that resolves to an object with the
   *          operation result status. See `FileSaver.save` method for details.
   */
  static async save(entries, filename, readme) {
    const zipfile = FileArchiver.#createZip(entries, readme);
    const content = zipfile
      ? await zipfile.generateAsync({ type: "blob" })
      : undefined;
    return FileSaver.save(content, filename);
  }

  /**
   * (Private function) Creates a ZIP archive containing the provided entries
   * and an optional readme.
   *
   * @param {Array<{data: Blob, filename: string, src?: string}>} entries
   *        An array of objects representing entries to be archived. See `save`
   *        method for details.
   * @param {string} readme Optional readme content to include in the archive.
   * @returns {JSZip|undefined} A JSZip instance containing the archive or
   *          undefined if no entries were archived.
   */
  static #createZip(entries, readme) {
    let count = 0;
    let empty = true;
    const zipfile = new JSZip();
    for (const entry of entries) {
      empty = false;
      if ("data" in entry) {
        zipfile.file(entry.filename, entry.data);
        logger.debug("FA001", `File archived: '${entry.filename}'`);
        ++count;
      } else {
        logger.warn("FA002", `No data to archive: '${entry.filename}'`);
      }
    }
    if (count) {
      if (readme) {
        zipfile.file(README_TXT, readme);
      }
    } else if (empty) {
      logger.info("FA003", "No entries to archive");
    } else {
      logger.info("FA004", "No entries archived");
    }
    const logfile = logger.store.toString();
    if (logfile) {
      zipfile.file(RETSPY_LOG, logfile);
    }
    return zipfile;
  }
}

/**
 * Class to download a sequence of files and create an archive with an optional
 * readme.
 *
 * TODO: The code assumes basic knowledge of data URLs and encoding/decoding
 *       processes. Consider adding comments within helper functions for
 *       clarification if needed.
 */
class FileDownloader {
  /**
   * Downloads a sequence of files and creates an archive with the specified
   * filename and an optional readme.
   *
   * The `params` object can be used to specify options for the fetch requests
   * and follows the usual fetch options format:
   *
   * params = { method: "GET", headers: { ... }, ... }
   *
   * @param {Array<[string, string]>} sequence An array of URL-filename pairs.
   *        Each element represents a file to be downloaded. The first element
   *        is the URL of the file, and the second element is the desired
   *        filename for the downloaded content in the archive.
   * @param {string} filename The desired filename for the final archive.
   * @param {object} params Options for the fetch requests (e.g., method,
   *        headers).
   * @param {string} readme Optional readme content to include in the archive.
   * @returns {Promise<object>} A promise that resolves to an object with the
   *          operation result status. See `FileSaver.save` method for details.
   */
  static async download(sequence, filename, params, readme) {
    const entries = await FileDownloader.#getData(sequence, params);
    return FileArchiver.save(entries, filename, readme);
  }

  /**
   * (Private function) Fetches the content from the specified URL and returns
   * an object with the URL, filename, and downloaded data (if successful).
   *
   * @param {Array<string>} item An array containing the URL and desired
   *        filename, (`[URL, filename]`).
   * @param {object} params Options for the fetch request (e.g., method,
   *        headers). See `download` method for details.
   * @returns {Promise<object>} A promise that resolves to an object with the
   *          URL, filename, and downloaded data (if successful). See
   *          `FileArchiver.save` method for details.
   */
  static async #fetch(item, params) {
    const src = item[0];
    const filename = item[1];
    let network_error = true;
    let decoding_error = true;
    try {
      const response = await fetch(src, params);
      network_error = false;
      const statusMessage = `${response.status} ${response.statusText}`;
      if (!response.ok) {
        decoding_error = false;
        throw new Error(statusMessage);
      }
      const data = await response.blob();
      logger.info("FD001", `File fetched: '${src}'`);
      if (response.status === 200) {
        logger.debug("FD002", `Response status: ${statusMessage}`);
      } else {
        logger.warn("FD003", `Response status: ${statusMessage}`);
      }
      return { src, filename, data };
    } catch (error) {
      logger.error("FD101", `Failed to fetch: '${src}'`);
      if (network_error) {
        logger.info("FD104", `Network error: '${error.message}'`);
      } else if (decoding_error) {
        logger.info("FD103", `Decoding error: '${error.message}'`);
      } else {
        logger.info("FD102", `HTTP error: ${error.message}`);
      }
      return { src, filename };
    }
  }

  /**
   * (Private function) Fetches all items in the sequence concurrently and
   * returns an array of objects containing the URL, filename, and downloaded
   * data (if successful).
   *
   * @param {Array<[string, string]>} sequence An array of URL-filename pairs.
   * @param {object} params Options for the fetch requests (e.g., method,
   *        headers). See `download` method for details.
   * @returns {Promise<Array<object>>} A promise that resolves to an array of
   *          objects representing the downloaded entries.
   */
  static #getData(sequence, params) {
    const loaders = [];
    params = params || { method: "GET" };
    for (const item of sequence) {
      loaders.push(FileDownloader.#fetch(item, params));
    }
    return Promise.all(loaders);
  }
}

/**
 * Class for asynchronously loading images from URLs.
 */
class ImageLoader {
  /**
   * Loads a sequence of images from the provided URLs.
   *
   * @param {Array<[string, string]>} sequence An array of URL-filename pairs.
   *        Each element represents an image to be downloaded. The first
   *        element is the URL of the image file, and the second element is the
   *        desired filename for the downloaded image file.
   * @returns {Promise<Array<object>>} A promise that resolves to an array of
   *          objects representing the loaded images. Each object has the URL,
   *          filename, and downloaded data (if successful). See
   *          `FileArchiver.save` method for details.
   */
  static load(sequence) {
    const loaders = [];
    for (const item of sequence) {
      loaders.push(ImageLoader.#fetch(item));
    }
    return Promise.all(loaders);
  }

  /**
   * (Private function) Fetches a single image from the specified URL and
   * returns a promise that resolves to an object containing the image data.
   *
   * @param {Array<string>} item An array containing the URL and desired
   *        filename, (`[URL, filename]`).
   * @returns {Promise<object>} A promise that resolves to an object with the
   *          URL, filename, and downloaded data (if successful). See
   *          `FileArchiver.save` method for details.
   */
  static #fetch(item) {
    const src = item[0];
    const filename = item[1];
    return new Promise((resolve) => {
      const img = new Image();
      img.addEventListener("load", () => {
        logger.info("IL001", `Image loaded: '${src}'`);
        resolve({ src, filename, data: img });
      });
      img.addEventListener("error", () => {
        logger.error("IL101", `Failed to load: '${src}'`);
        resolve({ src, filename });
      });
      img.addEventListener("abort", () => {
        logger.info("IL102", `Aborted loading: '${src}'`);
        resolve({ src, filename });
      });
      img.src = src;
    });
  }
}

/**
 * Class for downloading a sequence of images, encoding them to a specific
 * format, and creating an archive with an optional readme.
 */
class ImageDownloader {
  /**
   * Downloads a sequence of images, encodes them to the specified format, and
   * creates an archive with the specified filename and an optional readme.
   *
   * @param {Array<[string, string]>} sequence An array of URL-filename pairs.
   *        Each element represents an image to be downloaded. The first
   *        element is the URL of the image, and the second element is the
   *        desired filename for the downloaded image.
   * @param {string} filename The desired filename for the final archive.
   * @param {string} type The desired image format for encoding the downloaded
   *        images (e.g., ".png", ".jpeg", ".webp").
   * @param {string} readme Optional readme content to include in the archive.
   * @returns {Promise<object>} A promise that resolves to an object with the
   *          operation result status. See `FileSaver.save` method for details.
   */
  static async download(sequence, filename, type, readme) {
    let entries = await ImageLoader.load(sequence);
    entries = ImageDownloader.#encodeData(entries, type);
    return FileArchiver.save(entries, filename, readme);
  }

  /**
   * (Private function) Draws an image onto a canvas element.
   *
   * @param {Image} image The image to be drawn.
   * @returns {HTMLCanvasElement} The canvas element containing the drawn
   *          image.
   */
  static #drawImage(image) {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    return canvas;
  }

  /**
   * (Private function) Encodes the image data in the provided entries to the
   * specified format.
   *
   * @param {Array<object>} entries An array of entries, each with a `data`
   *        property containing the image data. See `FileArchiver.save` method
   *        for details.
   * @param {string} type The desired image format for encoding (e.g., ".png",
   *        ".jpeg", ".webp").
   * @returns {Array<object>} A new array of entries with the encoded image
   *          data.
   */
  static #encodeData(entries, type) {
    const imageEntries = [];
    for (const entry of entries) {
      if ("data" in entry) {
        try {
          entry.data = ImageDownloader.#encodeImage(entry.data, type);
          imageEntries.push(entry);
        } catch (error) {
          logger.error("ID101", `Image encoding failed: '${entry.filename}'`);
          logger.debug("ID102", `Failed to encode: ${error.message}`);
        }
      }
    }
    return imageEntries;
  }

  /**
   * (Private function) Encodes a single image to the specified format.
   *
   * @param {Image} image The image to be encoded.
   * @param {string} type The desired image format (e.g., ".png", ".jpeg",
   *        ".webp").
   * @returns {string} The encoded image data as a data URL.
   */
  static #encodeImage(image, type) {
    const canvas = ImageDownloader.#drawImage(image);
    const mimeType = IMG_MEDIA[type];
    const dataURL = canvas.toDataURL(mimeType);
    return ImageDownloader.#urlToBlob(dataURL);
  }

  /**
   * (Private function) Converts a data URL to a Blob object.
   *
   * @param {string} dataURI The data URL to be converted.
   * @returns {Blob} The converted Blob object.
   */
  static #urlToBlob(dataURI) {
    const byteString = atob(dataURI.split(",")[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.codePointAt(i);
    }
    const mimeType = dataURI.split(",")[0].split(":")[1].split(";")[0];
    return new Blob([uint8Array], { type: mimeType });
  }
}

export {
  FileArchiver,
  FileDownloader,
  FileSaver,
  IMAGE,
  ImageDownloader,
  ImageLoader,
  IMG_TYPE,
  logger,
};
