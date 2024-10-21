// @ ts-check
import { dict, zip } from "./common.js";
import {
  ARC_TYPE,
  ARCHIVE,
  FileDownloader,
  IMAGE,
  ImageDownloader,
  VIDEO,
  VideoDownloader,
} from "./downloader.js";
import {
  Button,
  ButtonGroup,
  DialogWindow,
  GuiElement,
  ModalWall,
} from "./gui.js";
import { DateUtils, FilenameUtils } from "./shared.js";

const _MER_ = "MER";
const _PAR_ = "PAR";
const _SEC_ = "SEC";

const _BAND13_ = "BAND13";
const _FCOLOR_ = "FCOLOR";

const dmh_settings = {
  name: "DMH downloader tool",
  prefix: "DMH_",
  params: {
    cache: "default", // NA
    credentials: "include", // ALT="omit"
    headers: {
      accept:
        "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "accept-language": "en-GB,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
      priority: "i",
      "sec-ch-ua":
        '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "image",
      "sec-fetch-mode": "no-cors",
      "sec-fetch-site": "same-origin",
    }, // NR
    keepalive: false, // NA
    method: "GET", // R
    mode: "cors", // R
    referrer: "", // R
    referrerPolicy: "strict-origin-when-cross-origin", // R
  },
  satellite: {
    fps: {
      current: 4,
      min: 1,
      max: 30,
    },
    instrument: "G16",
    product: {
      current: _FCOLOR_,
      supported: [
        _FCOLOR_,
        "BAND02",
        "BAND07",
        "BAND08",
        "BAND09",
        _BAND13_,
        "BAND14",
        "BAND15",
        "DCPRGB",
        "NMPRGB",
      ],
    },
    root: "https://www.meteorologia.gov.py/satelite-goes-16",
    sector: {
      current: _SEC_,
      supported: [_PAR_, _MER_, _SEC_],
    },
    interval: 10 * 60 * 1000,
    type: {
      current: IMAGE.JPG,
      source: IMAGE.JPG, // original files are JPGs
      supported: [IMAGE.JPG, IMAGE.PnG],
    },
    replace_video_button: dict([_PAR_, _MER_, _SEC_], [true, false, false]),
  },
};

const PRODUCT = dict(dmh_settings.satellite.product.supported, [
  "Falso Color [Banda 02 + Banda 13]",
  "Banda 02 [0.64 µm (Rojo)]",
  "Banda 07 [3.90 µm (Infrarrojo de Onda Corta)]",
  "Banda 08 [6.20 µm (Vapor de Agua - Niveles Altos)]",
  "Banda 09 [6.90 µm (Vapor de Agua - Niveles Medios)]",
  "Banda 13 [10.30 µm (Infrarrojo de Onda Larga - Limpio)]",
  "Banda 14 [11.20 µm (Infrarrojo de Onda Larga)]",
  "Banda 15 [12.30 µm (Infrarrojo de Onda Larga - Sucio)]",
  "DCP RGB [Distinción de fase de nube Diurna (Compuesto RGB)]",
  "NMP RGB [Microfisica Nocturna (Compuesto RGB)]",
  // "Descargas Atmosféricas [GLM (20s) + Banda 13]", // gli20s
  // "Descargas Atmosféricas [GLM (20s)]", // glm20s
]);

const SECTOR = dict(dmh_settings.satellite.sector.supported, [
  "Paraguay",
  "Mercosur",
  "Sudamérica",
]);

const SECT_MAP = {
  paraguay: _PAR_,
  mercosur: _MER_,
  sudamerica: _SEC_,
};

function main() {
  let message = "No query parameters found";
  const query = new URLSearchParams(globalThis.location.search);
  if (query.size > 0) {
    message = "Query parameters found";
    const product = query.get("producto").toUpperCase();
    if (dmh_settings.satellite.product.supported.includes(product)) {
      dmh_settings.satellite.product.current = product;
    } else {
      console.warn(`${message}: Invalid product: ${product}`);
    }

    let sector = query.get("sector").toLowerCase();
    sector = SECT_MAP[sector];
    if (dmh_settings.satellite.sector.supported.includes(sector)) {
      dmh_settings.satellite.sector.current = sector;
    } else {
      console.warn(`${message}: Invalid sector: ${sector}`);
    }
  }
  console.debug(
    `${message}: ` +
      `${dmh_settings.satellite.product.current}, ` +
      `${dmh_settings.satellite.sector.current}`,
  );
}

/**
 * Class representing a range of satellite data URLs based on provided
 * settings, start date, and end date.
 */
class SatelliteURLRange {
  /**
   * Constructs a SatelliteURLRange object, which represents a range of URLs
   * for satellite data based on provided settings, start date, and end date.
   *
   * @param {Object} settings An object containing settings for the DMH
   *        downloader tool.
   * @param {Date} beginDate (Optional) The beginning date for the URL range.
   * @param {Date} endDate (Optional) The ending date for the URL range.
   *
   * @throws {TypeError} If any of the parameters are not of the expected
   *         types.
   */
  constructor(settings, beginDate, endDate) {
    // Current `satellite` section of the settings for the DMH downloader tool.
    if (beginDate) {
      beginDate = DateUtils.truncateDate(beginDate, settings.interval);
    }
    this._urls = SatelliteURLRange.get(settings, beginDate, endDate);
  }

  /**
   * Creates or retrieves a SatelliteURLRange object.
   *
   * @param {Object} settings An object containing settings for the DMH
   *        downloader tool.
   * @param {Date} beginDate (Optional) The beginning date for the URL range.
   * @param {Date} endDate (Optional) The ending date for the URL range.
   * @returns {SatelliteURLRange} A SatelliteURLRange object representing the
   *          URL range.
   *
   * - If both `beginDate` and `endDate` are undefined, captures the current
   *   URL range from the DMH site's satellite page.
   * - Otherwise, creates a new URL range based on the provided settings and
   *   dates.
   * - If only one of `beginDate` or `endDate` is undefined, the operation
   *   status becomes undefined, requiring the caller to handle this
   *   situation before proceeding.
   */
  static get(settings, beginDate, endDate) {
    if (beginDate === undefined && endDate === undefined) {
      return SatelliteURLRange.#capture(settings);
    }
    return SatelliteURLRange.#create(settings, beginDate, endDate);
  }

  /**
   * (Private method) Captures the current URL range from settings.
   *
   * @param {Object} settings An object containing settings for the DMH
   *        downloader tool.
   * @returns {string[]} An array of URLs representing the current URL range.
   */
  static #capture(settings) {
    // as of 2024-10-04 at https://www.meteorologia.gov.py/satelite-goes-16
    const urls = [];
    for (const partial of globalThis.scans) {
      urls.push(`${settings.root}/${partial}`);
    }
    return urls;
  }

  /**
   * (Private method) Creates a URL range based on settings, begin date, and
   * end date.
   *
   * @param {Object} settings An object containing settings for the DMH
   *        downloader tool.
   * @param {Date} beginDate The beginning date for the URL range.
   * @param {Date} endDate The ending date for the URL range.
   * @returns {string[]} An array of URLs representing the generated URL range.
   */
  static #create(settings, beginDate, endDate) {
    const baseURL = SatelliteURLRange.#buildBaseURL(settings);
    const typeURL = settings.type.source;
    const urls = [];
    let currentDate = beginDate;
    const scanInterval = settings.interval;
    while (currentDate <= endDate) {
      const dateURL = SatelliteURLRange.#buildDateURL(currentDate);
      urls.push(baseURL + dateURL + typeURL);
      currentDate = SatelliteURLRange.#nextDate(currentDate, scanInterval);
    }
    return urls;
  }

  /**
   * (Private method) Builds the base URL for satellite data based on settings.
   *
   * @param {Object} settings An object containing settings for the DMH
   *        downloader tool.
   * @returns {string} The base URL for constructing satellite data URLs.
   */
  static #buildBaseURL(settings) {
    // DMH specific settings.

    const rootURL = settings.root;
    const instURL = settings.instrument;
    const prodURL = settings.product.current;
    const sectURL = settings.sector.current;
    const seriURL = `${prodURL}_${sectURL}`;

    return `${rootURL}/${instURL}/${seriURL}/${instURL}_${seriURL}_`;
  }

  /**
   * (Private method) Builds a date URL string based on the provided date.
   *
   * @param {Date} date The date to be formatted into a URL string.
   * @returns {string} The formatted date URL string.
   */
  static #buildDateURL(date) {
    // DMH specific settings.

    const year = SatelliteURLRange.#pad(date.getUTCFullYear(), 4);
    const month = SatelliteURLRange.#pad(date.getUTCMonth() + 1, 2);
    const day = SatelliteURLRange.#pad(date.getUTCDate(), 2);
    const hours = SatelliteURLRange.#pad(date.getUTCHours(), 2);
    const minutes = SatelliteURLRange.#pad(date.getUTCMinutes(), 2);

    return `${year}${month}${day}${hours}${minutes}`;
  }

  /**
   * (Private method) Calculates the next date based on the given date and
   * interval.
   *
   * @param {Date} date The starting date.
   * @param {number} interval The interval in milliseconds to add to the
   *        starting date.
   * @returns {Date} The next date based on the provided parameters.
   */
  static #nextDate(date, interval) {
    return new Date(date.getTime() + interval);
  }

  /**
   * (Private method) Pads a number with leading zeros to a specified length.
   *
   * @param {number} number The number to be padded.
   * @param {number} pad The desired length of the padded string.
   * @returns {string} The padded number as a string.
   */
  static #pad(number, pad) {
    return number.toString().padStart(pad, "0");
  }

  /**
   * Gets the array of URLs generated by the SatelliteURLRange object.
   *
   * @returns {string[]} An array of URLs representing the generated URL range.
   */
  get urls() {
    return this._urls;
  }
}

/**
 * Class responsible for downloading satellite data based on a provided URL
 * list. Offers various download methods for different types of data (images,
 * videos).
 */
class SatelliteDownloader {
  /**
   * Constructs a SatelliteDownloader object to manage downloading satellite
   * data.
   *
   * @param {string[]} urls An array of URLs for the satellite data to be
   *        downloaded.
   */
  constructor(urls) {
    this._urls = urls;
  }

  /**
   * Downloads satellite data images in their original format as a ZIP archive.
   *
   * This method assumes the user wants the images in their original format. If
   * the user requires a specific format, use the `downloadImages` method
   * instead.
   *
   * The caller is responsible for setting the fetch parameters.
   *
   * @param {string[]} filenames An array of filenames for the downloaded
   *        images.
   * @param {string} archivename The name of the ZIP archive to create.
   * @param {Object} params (Optional) An object containing additional
   *        parameters for the download request (implementation specific to
   *        FileDownloader).
   * @returns {Promise<Response>} A Promise object representing the download
   *          operation. The resolved value is a Response object containing
   *          download details.
   */
  downloadFiles(filenames, archivename, type, params) {
    const readme = SatelliteDownloader.#getReadMe(filenames);
    const sequence = zip(this._urls, filenames);
    const promise = FileDownloader.download(
      sequence,
      archivename,
      type,
      params,
      readme,
    );
    SatelliteDownloader.#setupResponseActions(promise, archivename);
  }

  /**
   * Downloads satellite data images in a user-specified format as a ZIP
   * archive.
   *
   * If the user requires the images to be in their original format, the
   * `downloadFiles` method should be called instead. The caller is responsible
   * for determining such situations.
   *
   * @param {string[]} filenames An array of filenames for the downloaded
   *        images.
   * @param {string} archivename The name of the ZIP archive to create.
   * @param {string} imgtype (Optional) The desired format for the downloaded
   *        images (e.g., ".png"). Defaults to ".PNG_".
   * @returns {Promise<Response>} A Promise object representing the download
   *          operation. The resolved value is a Response object containing
   *          download details.
   */
  downloadImages(filenames, archivename, imgtype, arctype) {
    const readme = SatelliteDownloader.#getReadMe(filenames);
    const sequence = zip(this._urls, filenames);
    const promise = ImageDownloader.download(
      sequence,
      archivename,
      imgtype,
      arctype,
      readme,
    );
    SatelliteDownloader.#setupResponseActions(promise, archivename);
  }

  /**
   * Downloads a video from satellite data URLs, combining them into a single
   * video file.
   *
   * @param {string} filename The desired filename for the downloaded video.
   * @param {number} fps The desired frames per second for the video.
   * @param {string} type (Optional) The desired format for the downloaded
   *        video (e.g., ".mp4"). Defaults to ".MP4_".
   * @returns {Promise<Response>} A Promise object representing the download
   *          operation. The resolved value is a Response object containing
   *          download details.
   */
  downloadVideo(filename, fps, type = VIDEO.MP4) {
    const filenames = FilenameUtils.getFilenames(this._urls);
    const sequence = zip(this._urls, filenames);
    const promise = VideoDownloader.download(sequence, filename, fps, type);
    SatelliteDownloader.#setupResponseActions(promise, filename);
  }

  /**
   * (Private helper function) Sets up response handling actions (logging and
   * user alerts) for a download Promise.
   *
   * @param {Promise<Response>} promise The download Promise object.
   * @param {string} filename The name of the downloaded file (archive or
   *        video).
   */
  static #setupResponseActions(promise, filename) {
    promise
      .then((result) => {
        if (result.ok) {
          console.info(`${result.message}: '${filename}' downloaded!`);
        } else {
          console.warn(`${result.message}: '${filename}' failed!`);
        }
      })
      .catch((error) => {
        if (error instanceof Error) {
          console.error(error);
        } else if (error.message == "empty") {
          console.info(`${error.message}: '${filename}' no data!`);
          alert("No existen imágenes disponibles en el rango solicitado.");
        } else if (error.error) {
          console.info(`${error.message}: '${filename}':`, error.error);
        } else {
          console.warn(`${error.message}: '${filename}' failed!`);
        }
      });
  }

  /**
   * (Private helper function) Generates a README string based on the provided
   * filenames.
   *
   * @param {string[]} filenames An array of filenames.
   * @returns {string} A README string listing the filenames and additional
   *          information.
   */
  static #getReadMe(filenames) {
    const datetime = DateUtils.currentISODate();
    const sector = SECTOR[dmh_settings.satellite.sector.current];
    const product = PRODUCT[dmh_settings.satellite.product.current];
    const filelist = filenames.join("\n");
    const year = datetime.slice(0, 4);
    return `Imágenes del satélite GOES-16 (${datetime})
=========================================================

Sector: ${sector}
Producto: ${product}

Este producto contiene imágenes del satélite GOES-16, que es operado por la
NOAA y la NASA. Las imágenes son generadas por la Dirección de Meteorología e
Hidrología de la DINAC con datos recibidos a través de su Estación Geonetcast,
y son distribuidas a través de su sitio web.

El producto contiene imágenes de la región de América del Sur, y se actualiza
cada 10 minutos. Las imágenes son generadas en formato JPG, y se encuentran
disponibles en el enlace: https://www.meteorologia.gov.py/satelite-goes-16.

Imágenes solicitadas:
--------------------------------
${filelist}
--------------------------------

Observación: La lista anterior enumera los archivos que se intentaron
recuperar. Algunos archivos pueden no haberse recuperado. Los archivos
recuperados se incluyen en el archivo ZIP. El archivo RETSPY.log puede
contener información adicional de las razones por las que no se pudieron
recuperar algunos archivos.

---
Copyright ${year}, Dirección de Meteorología e Hidrología.
Vía RETSpy - Proyecto de Reporte de Eventos de Tiempo Severo - Paraguay.

Para información adicional puede descargar la documentación técnica (en
inglés, francés o español) en los enlaces de la siguiente página web:

https://www.goes-r.gov/mission/ABI-bands-quick-info.html

---
Centro Meteorológico Nacional
Cnel. Francisco López 1080 c/ De la Conquista
Tel: +595 21 438 1000
Fax: +595 21 438 1220
`;
  }
}

class Dashboard extends ModalWall {
  constructor(width, height) {
    super();
    this.hide();
    document.body.append(this.element);

    this.panel = new DialogWindow("", [width, height]); //#1A213D #2E318E
    this.panel.title = "RETSpy — Panel de descarga de imágenes";
    this.body.append(this.panel);

    this.registerEvent("close");
    this.addEventListener("close", () => this.hide());
    this.entangleEvents("click", "close", ".retspy-close");

    this.button_d = Dashboard.#createDownloadButton();
    this.button_p = Dashboard.#createButton(this);
  }

  static download() {
    dmh_settings.params.referrer = dmh_settings.satellite.root;

    const range = new SatelliteURLRange(dmh_settings.satellite);
    let fln = FilenameUtils.getFilenames(range.urls);
    let zfn = FilenameUtils.buildArchiveFilename(
      range.urls,
      dmh_settings.prefix,
      ARC_TYPE.ZIP,
    );
    let fdl = new SatelliteDownloader(range.urls);
    fdl.downloadFiles(fln, zfn, ARCHIVE.ZIP, dmh_settings.params);
    // fdl.downloadImages(fln, zfn, IMAGE.JPG, ARCHIVE.ZIP);
    // fdl.downloadVideo("video.mp4", 4, VIDEO.MP4);
  }

  static #downloadRange() {
    const begin = new Date("2024-06-15T00:24:32-04:00");
    const end = new Date("2024-06-16T01:26:41-04:00");
    const range2 = new SatelliteURLRange(dmh_settings.satellite, begin, end);
    let fln = FilenameUtils.getFilenames(range2.urls);
    let zfn = FilenameUtils.buildArchiveFilename(
      range2.urls,
      dmh_settings.prefix,
    );
    let fdl = new SatelliteDownloader(range2.urls);
    fdl.downloadFiles(fln, zfn, dmh_settings.params);
  }

  static #createDownloadButton() {
    const button = new Button("Descarga", ".btn.btn-default");
    button.registerEvent("download");
    button.addEventListener("download", () => Dashboard.download());
    button.entangleEvents("click", "download");

    const buttonContainer = document.querySelector(".row .btn-group");
    const lastButton = buttonContainer.querySelector("a:last-child");

    const sector = dmh_settings.satellite.sector.current;
    const replace_button = dmh_settings.satellite.replace_video_button[sector];
    if (replace_button) {
      buttonContainer.replaceChild(button.element, lastButton);
    } else {
      buttonContainer.insertBefore(button.element, lastButton.nextSibling);
    }

    return button;
  }

  static #createButton(dashboard) {
    const popup = Dashboard.#createPopup(dashboard);

    const button = new Button("▼", ".btn.btn-default");
    button.registerEvent("open-popup");
    button.addEventListener("open-popup", (data) => {
      popup.toggle();
      const event = data.parameters;
      event.stopPropagation();
    });
    button.entangleEvents("click", "open-popup");

    const buttonContainer = document.querySelector(".row .btn-group");
    const lastButton = buttonContainer.querySelector("button:last-child");

    buttonContainer.insertBefore(popup.element, lastButton.nextSibling);
    buttonContainer.insertBefore(button.element, popup.element.nextSibling);

    return button;
  }

  static #createPopup(dashboard) {
    const button1 = new Button("Descarga Por Fecha", ".btn.btn-default");
    const button2 = new Button("Descarga Avanzada", ".btn.btn-default");

    const group = new ButtonGroup(
      ".retspy-menu.btn-group.btn-group-vertical.btn-group-sm",
    );
    group.append([button1, button2]);

    const popup = new GuiElement("div#retspy-menu.retspy-popup-menu");
    popup.append(group);
    popup.hide();

    for (const button of [button1, button2]) {
      button.registerEvent("open-dialog");
      button.addEventListener("open-dialog", () => dashboard.toggle());
      button.entangleEvents("click", "open-dialog");

      button.registerEvent("close-popup");
      button.addEventListener("close-popup", () => popup.toggle());
      button.entangleEvents("click", "close-popup");
    }

    document.addEventListener("click", (event) => {
      if (!popup.element.contains(event.target) && popup.visible()) {
        popup.hide();
      }
    });

    return popup;
  }
}

window.addEventListener("load", () => {
  const dashboard = new Dashboard("400px", "300px");
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}

// class SatelliteTool {
//     constructor() {
//         this.settings = {
//             name: "DMH downloader tool",
//             prefix: "DMH_",
//             params: {
//                 method: "GET",
//                 mode: "cors",
//                 cache: "default",
//                 credentials: "omit",
//                 keepalive: false,
//                 referrer: "",
//                 referrerPolicy: "strict-origin-when-cross-origin",
//             },
//             satellite: {
//                 fps: {
//                     current: 4,
//                     min: 1,
//                     max: 30,
//                 },
//                 instrument: "G16",
//                 product: {
//                     current: _BAND13_,
//                     supported: [
//                         "FCOLOR", "BAND02", "BAND07", "BAND08", "BAND09",
//                         _BAND13_, "BAND14", "BAND15", "DCPRGB", "NMPRGB",
//                     ],
//                 },
//                 root: "https://www.meteorologia.gov.py/satelite-goes-16",
//                 sector: {
//                     current: _PAR_,
//                     supported: [_PAR_, "MER", "SEC"]
//                 },
//                 interval: 10 * 60 * 1000,
//                 type: {
//                     current: _JPG_,
//                     source: _JPG_, // original files are JPGs
//                     supported: [_JPG_, ".png"],
//                 },
//             }
//         }
//     }

//     createRangeURLs(beginDate, endDate) {
//         const baseURL = this.buildBaseURL();
//         const typeURL = this.settings.satellite.type.source

//         const nextDate = (date, interval) => new Date(date.getTime() + interval);

//         const urls = [];

//         let currentDate = beginDate;
//         const scanInterval = this.settings.satellite.interval;

//         while (currentDate <= endDate) {
//             const dateURL = this.buildDateURL(currentDate);
//             const urlImagen = baseURL + dateURL + typeURL;
//             urls.push(urlImagen);
//             currentDate = nextDate(currentDate, scanInterval);
//         }

//         return urls;
//     }

//     captureCurrentURLs() {
//         // as of 2024-10-04 at https://www.meteorologia.gov.py/satelite-goes-16
//         console.debug({ "window.scans": window.scans });

//         const urls = [];

//         for (const partial of window.scans) {
//             urls.push(`${this.settings.satellite.root}/${partial}`);
//         }
