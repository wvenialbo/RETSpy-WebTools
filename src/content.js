class InjectionTarget {
  constructor(node, index = 0) {
    this.target = document.querySelectorAll(node)[index];
  }

  #appendNodes(nodes) {
    for (const node of nodes) {
      console.debug(`append node: ${node.tagName}`, { node });
      this.target.append(node);
    }
    return this;
  }

  injectScripts(entries) {
    entries = Array.isArray(entries) ? entries : [entries];
    console.debug(`injecting scripts: ${entries.map((entry) => entry.src)}`);
    const nodes = entries.map((entry) => InjectionTarget.#createScript(entry));
    return this.#appendNodes(nodes);
  }

  static #createScript(entry) {
    const script = document.createElement("script");
    script.type = entry.module ? "module" : "text/javascript";
    script.src = chrome.runtime.getURL(entry.src);
    script.async = entry.async || false;
    script.addEventListener("load", () => {
      InjectionTarget.#onLoad(entry.src);
    });
    script.addEventListener("error", (event) => {
      InjectionTarget.#onError(entry.src, event);
    });
    return script;
  }

  injectLinks(entries) {
    entries = Array.isArray(entries) ? entries : [entries];
    console.debug(`injecting links: ${entries.map((entry) => entry.href)}`);
    const nodes = entries.map((entry) => InjectionTarget.#createLink(entry));
    return this.#appendNodes(nodes);
  }

  static #createLink(entry) {
    const link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL(entry.href);
    link.async = entry.async || false;
    link.addEventListener("load", () => {
      InjectionTarget.#onLoad(entry.href);
    });
    link.addEventListener("error", (event) => {
      InjectionTarget.#onError(entry.href, event);
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

      this.#appendNodes([script]);
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

    const scripts = [
      { src: "lib/fflate.js", async: true, module: true },
      { src: "src/common.js", async: true, module: true },
      { src: "src/logging.js", async: true, module: true },
      { src: "src/downloader.js", async: true, module: true },
      { src: "src/gui.js", async: true, module: true },
      { src: "src/shared.js", async: true, module: true },
      { src: "src/dmh.js", async: true, module: true },
    ];

    const css = { href: "assets/dmh.css" };

    const head = new InjectionTarget("head");
    head.injectLinks(css);

    const body = new InjectionTarget("body");
    body.injectScripts(scripts);
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
