/**
 * Represents a Graphical User Interface (GUI) element for building and
 * managing HTML elements with a focus on readability and maintainability.
 *
 * This class provides a convenient way to create and manipulate HTML elements
 * using a string specification or existing DOM elements. It also offers
 * methods for attaching event listeners and managing element relationships.
 */
class GuiElement {
  /**
   * @private
   * @type {Element}
   * The underlying DOM element associated with this GuiElement instance.
   */
  #element;
  /**
   * @private
   * @type {Object.<string, Function[]>}
   * A map of registered event names to their corresponding listener functions.
   */
  #events = {};

  /**
   * Creates a new GuiElement instance.
   *
   * @param {string|Element|GuiElement} source - The source for creating the
   *        element.
   *        - If a string is provided, it represents a specification for
   *          creating a new element.
   *        - If an Element is provided, it becomes the underlying element for
   *          this GuiElement.
   *        - If a GuiElement is provided, its element is transferred to this
   *          instance (ownership is moved).
   * @throws {TypeError} If the provided source is not a string, Element, or
   *         GuiElement.
   */
  constructor(source = "") {
    if (typeof source === "string") {
      this.#element = GuiElement.#specificationConstructor(source);
    } else if (source instanceof GuiElement) {
      this.#element = GuiElement.#moveConstructor(source);
    } else if (source instanceof Element) {
      this.#element = source;
    } else {
      throw new TypeError("`source` must be a string, Element, or GuiElement");
    }
  }

  static create(source) {
    return new GuiElement(source);
  }

  static #moveConstructor(source) {
    const captured = source.element;
    source.element = undefined;
    return captured;
  }

  /**
   * Creates a new GuiElement instance from a string specification.
   *
   * @param {string} specification - A string specifying the element to create.
   *        The format is `tagName#id.class1.class2...`, where:
   *        - tagName (optional): The HTML tag name (e.g., "div", "span").
   *          Defaults to "div".
   *        - id (optional): An ID attribute for the element
   *          (e.g., "#myElement").
   *        - class (optional): One or more CSS classes separated by dots
   *          (e.g., ".error.important").
   * @throws {SyntaxError} If the provided specification is invalid.
   * @returns {Element} The newly created DOM element.
   * @private
   */
  static #specificationConstructor(specification) {
    const specifications = specification
      .split(" ")
      .filter((entry) => entry !== "");
    const attributes = specifications.map((specification) =>
      GuiElement.#parseSpecification(specification),
    );
    const elements = attributes.map((attribute) =>
      GuiElement.#createFromAttributes(...attribute),
    );
    const rootElement = elements[0];
    for (const element of elements.slice(1)) {
      rootElement.append(element);
    }
    return rootElement;
  }

  static #parseSpecification(specification) {
    const validPattern = /^(?:[a-z]+)?(?:#[a-z][\w-]*)?(?:\.[a-z][\w-]*)*$/;
    if (!validPattern.test(specification)) {
      throw new SyntaxError(`Invalid specification: "${specification}"`);
    }
    const pattern = /^([a-z]+)?(#[\w-]+)?((?:\.[\w-]+)*)$/;
    let [tagName, id, classNames] = specification.match(pattern).slice(1);
    tagName = tagName || "div";
    id = id || "";
    classNames = classNames ? classNames.split(".").slice(1) : [];
    return [tagName, id, classNames];
  }

  static #createFromAttributes(tagName, id, classes) {
    const element = document.createElement(tagName);
    element.id = id;
    element.classList.add(...classes);
    return element;
  }

  addEventListener(name, listener) {
    if (!(name in this.#events)) {
      throw new Error(`Event "${name}" not registered`);
    }
    this.#events[name].push(listener);
  }

  attachEventObserver(name, observer) {
    this.addEventListener(name, (event) => {
      observer.dispatchEvent(...event);
    });
  }

  append(source) {
    const elements = Array.isArray(source) ? source : [source];
    for (const element of elements) {
      if (element instanceof Element) {
        this.#element.append(element);
      } else if (element instanceof GuiElement) {
        this.#element.append(element.element);
      } else {
        throw new TypeError(
          "`source` must contain only instances of Element or GuiElement",
        );
      }
    }
  }

  entangleEvents(source, destination) {
    this.#element.addEventListener(source, (event) => {
      this.dispatchEvent(destination, event);
    });
  }

  dispatchEvent(name, parameters) {
    if (!(name in this.#events)) {
      throw new Error(`Event "${name}" not registered`);
    }
    for (const listener of this.#events[name]) {
      listener({ name, parameters });
    }
  }

  hide() {
    this.#element.style.display = "none";
  }

  querySelector(node) {
    return GuiElement.create(this.#element.querySelector(node));
  }

  querySelectorAll(node) {
    const elements = this.#element.querySelectorAll(node);
    return [...elements].map((element) => GuiElement.create(element));
  }

  registerEvent(name) {
    if (name in this.#events) {
      throw new Error(`Event "${name}" already registered`);
    }
    this.#events[name] = [];
  }

  resize(width, height) {
    this.size = [width, height];
  }

  show() {
    this.#element.style.display = "block";
  }

  toggle() {
    if (this.visible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  visible() {
    return this.#element.style.display != "none";
  }

  set classes(classes) {
    classes = Array.isArray(classes) ? classes : [classes];
    this.#element.classList.add(...classes);
  }

  set content(content) {
    if (typeof content == "string") {
      this.#element.innerHTML = content;
    } else if (content instanceof Element) {
      this.#element.innerHTML = content.outerHTML;
    } else if (content instanceof GuiElement) {
      this.#element.innerHTML = content.element.outerHTML;
    } else {
      throw new TypeError("`content` must be a string, Element, or GuiElement");
    }
  }

  get element() {
    return this.#element;
  }

  set height(height) {
    this.#element.style.height =
      typeof height == "number" ? `${height}px` : height;
  }

  set id(id) {
    this.#element.id = id;
  }

  set size(size) {
    [this.width, this.height] = size;
  }

  set text(text) {
    this.#element.textContent = text;
  }

  set width(width) {
    this.#element.style.width = typeof width == "number" ? `${width}px` : width;
  }
}

/**
 * Represents a titlebar element for a GUI application.
 *
 * Provides a customizable title and a close button.
 */
class Titlebar extends GuiElement {
  #label = GuiElement.create("span.retspy-content");

  /**
   * Constructs a new Titlebar element.
   *
   * @param {string} title (Optional) The initial title text for the titlebar.
   */
  constructor(title = "") {
    super(".retspy-titlebar .retspy-titleframe button.retspy-closebutton");
    this.registerEvent("close");
    this.title = title;

    const titleframe = this.querySelector(".retspy-titleframe");
    titleframe.append(this.#label);

    const closebutton = this.querySelector(".retspy-closebutton");
    closebutton.registerEvent("close");
    closebutton.entangleEvents("click", "close");
    closebutton.attachEventObserver("close", this);
  }

  /**
   * Sets the title text for the titlebar.
   *
   * @param {string} title The new title text.
   */
  set title(title) {
    this.#label.text = title;
  }
}

/**
 * Represents a statusbar element for a GUI application.
 *
 * Provides methods for adding sections, setting layout, and updating section
 * content.
 */
class Statusbar extends GuiElement {
  #section = [];

  /**
   * Constructs a new Statusbar element.
   */
  constructor() {
    super(".retspy-statusbar");
  }

  /**
   * Adds a new section to the statusbar.
   *
   * @param {string} type (Optional) The type of section (defaults to
   *        "retspy-bevel").
   * @param {string} width (Optional) The width of the section (defaults to
   *        "auto").
   * @returns {this} The current Statusbar instance.
   */
  addSection(type = "", width = "auto") {
    // type: retspy-flat, retspy-bevel (default)
    const section = Statusbar.#createSection(type);
    this.#section.push(section);
    this.append(section.frame);
    section.frame.width = width;
    return this;
  }

  /**
   * Creates a new statusbar section element.
   *
   * @param {string} type (Optional) The type of section (defaults to
   *        "retspy-bevel").
   * @returns {Object} An object representing the section, with `frame` and
   *          `label` properties.
   * @private
   */
  static #createSection(type) {
    type = type ? `.${type}` : ".retspy-bevel";
    const frame = new GuiElement(`.retspy-section span.retspy-content${type}`);
    const label = frame.querySelectorAll(".retspy-content");
    return { frame, label };
  }

  /**
   * Sets the layout of the statusbar sections.
   *
   * @param {string|string[]} layout An array of widths for each section, or a
   *        single width to apply to all sections.
   */
  set layout(layout) {
    layout = Array.isArray(layout) ? layout : [layout];
    const maxLength = Math.min(this.#section.length, layout.length);
    for (let index = 0; index < maxLength; index++) {
      this.#section[index].frame.width = layout[index];
    }
  }

  /**
   * Sets the text content of a specific section in the statusbar.
   *
   * @param {[string, number]} content The content to set. The first element is
   *        the text content, and the second element is the index of the
   *        section to update (starting from 0).
   */
  set section(content) {
    const [text, index] = content;
    this.#section[index].label.text = text;
  }

  /**
   * Sets the text content of a specific section in the statusbar.
   *
   * @param {string|string[]} content The text content to set. If an array is
   *        provided, it updates multiple sections.
   */
  set status(text) {
    text = Array.isArray(text) ? text : [text];
    const maxLength = Math.min(this.#section.length, text.length);
    for (let index = 0; index < maxLength; index++) {
      this.#section[index].label.text = text[index];
    }
  }
}

class PanelWindow extends GuiElement {
  #body = GuiElement.create(".retspy-content");
  #statusbar = new Statusbar();
  #titlebar = new Titlebar();

  constructor(id, size = [400, 300]) {
    super(".retspy-panel");
    this.registerEvent("close");
    this.size = size;
    this.id = id;

    this.append([this.#titlebar, this.#body, this.#statusbar]);
    this.#titlebar.attachEventObserver("close", this);
  }

  get body() {
    return this.#body;
  }

  set status(text) {
    this.#statusbar.status = text;
  }

  get statusbar() {
    return this.#statusbar;
  }

  set title(title) {
    this.#titlebar.title = title;
  }

  get titlebar() {
    return this.#titlebar;
  }
}

class ModalWall extends GuiElement {
  #container;

  constructor() {
    super(".retspy-modal .retspy-content");
    this.#container = this.querySelector(".retspy-content");
  }

  get body() {
    return this.#container;
  }
}

export { GuiElement, ModalWall, PanelWindow, Statusbar, Titlebar };
