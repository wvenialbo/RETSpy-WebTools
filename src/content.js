class InjectionTarget {
  constructor(node, index = 0) {
    this.target = document.querySelectorAll(node)[index];
  }

  #appendNode(node) {
    // console.debug("append", { node });
    this.target.append(node);
    return this;
  }

  #appendNodes(nodes) {
    for (const node of nodes) {
      this.#appendNode(node);
    }
    return this;
  }

  injectScript(url, async = true) {
    const node = InjectionTarget.#createScript(url, async);
    return this.#appendNode(node);
  }

  injectScripts(urls, async = true) {
    const nodes = urls.map((url) => InjectionTarget.#createScript(url, async));
    return this.#appendNodes(nodes);
  }

  static #createScript(url, async = true) {
    // console.debug(`injecting: ${url}`);

    const script = document.createElement("script");

    script.type = "text/javascript";
    script.src = chrome.runtime.getURL(url);
    script.async = async;

    script.addEventListener("load", () => {
      InjectionTarget.#onLoad(url);
    });
    script.addEventListener("error", (event) => {
      InjectionTarget.#onError(url, event);
    });

    return script;
  }

  injectLink(url, async = true) {
    const node = InjectionTarget.#createLink(url, async);
    return this.#appendNode(node);
  }

  injectLinks(urls, async = true) {
    const nodes = urls.map((url) => InjectionTarget.#createLink(url, async));
    return this.#appendNodes(nodes);
  }

  static #createLink(url, async = true) {
    // console.debug(`injecting: ${url}`);

    const link = document.createElement("link");

    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL(url);
    link.async = async;

    link.addEventListener("load", () => {
      InjectionTarget.#onLoad(url);
    });
    link.addEventListener("error", (event) => {
      InjectionTarget.#onError(url, event);
    });

    return link;
  }

  loader() {
    return Promise.resolve(this.#load.bind(this));
  }

  #load(url) {
    // console.debug(`loading: ${url}`);

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.addEventListener("load", () => {
        InjectionTarget.#onLoad(url);
        resolve(InjectionTarget.prototype.#load.bind(this));
      });
      script.addEventListener("error", (event) => {
        InjectionTarget.#onError(url, event, reject);
      });

      script.type = "text/javascript";
      script.src = chrome.runtime.getURL(url);

      this.#appendNode(script);
    });
  }

  static #onError(url, event, reject) {
    let message = `unable to load '${url}'`;
    if (event && event.message) {
      message = `${message}: ${event.message}`;
    }
    console.error(message);
    if (reject) {
      reject(event);
    }
  }

  static #onLoad(url) {
    console.debug(`loaded: '${url}'`);
  }
}

const dmh_tool = {
  name: "DMH downloader tool",

  main: () => {
    console.debug(`starting ${dmh_tool.name}`);

    const urls = [
      "../lib/jszip.min.js",
      "./common.js",
      "./logging.js",
      "../shared.js",
      "../dmh.js",
    ];

    const head = new InjectionTarget("head");
    head.injectLink("dmh.css", false);

    const body = new InjectionTarget("body");
    body.injectScripts(urls, false);
  },

  matches: ["https://www.meteorologia.gov.py/satelite-goes-16"],
};

const simepar_tool = {
  name: "SIMEPAR downloader tool",

  main: () => {
    console.debug(`starting ${simepar_tool.name}`);

    const target = new InjectionTarget("body");

    target
      .loader()
      .then((load) => load("jszip.min.js"))
      .then((load) => load("shared.js"))
      .then((load) => load("simepar.js"))
      .catch((error) => console.error(error));
  },

  matches: [
    "https://www.simepar.br/simepar/radar_msc",
    "https://lb01.simepar.br/riak/pgw-radar",
  ],
};

if (dmh_tool.matches.some((x) => globalThis.location.href.startsWith(x))) {
  try {
    dmh_tool.main();
  } catch (error) {
    console.error(`Unable to load: ${dmh_tool.name}`, error);
  }
}

if (simepar_tool.matches.some((x) => globalThis.location.href.startsWith(x))) {
  try {
    simepar_tool.main();
  } catch (error) {
    console.error(`Unable to load: ${simepar_tool.name}`, error);
  }
}
